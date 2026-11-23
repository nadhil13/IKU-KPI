import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_JSON_BODY_BYTES,
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
  sanitizePayload,
  applySecurityHeaders,
  extractTokenFromRequest,
  getClientIp,
} from '../config/security.js';
import {
  acquireRequestSlot,
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
  getRateLimiterTelemetry,
} from '../middleware/rateLimiter.js';
import {
  getDatabase,
  findUserByEmail,
  listAllUsers,
  verifyUserCredentials,
  syncUsersListFromAdmin,
  deleteUserByEmail,
  updateUserProfileByEmail,
  changeUserPasswordByEmail,
  createSessionRecord,
  revokeSessionRecord,
  isSessionActive,
  readKvStore,
  readAllKvStores,
  writeKvStore,
  readSpiAuditRecords,
  upsertSpiAuditRecord,
  appendAuditLog,
  listAuditLogs,
  verifyAuditChain,
  createBroadcast,
  listBroadcastsForUser,
  acknowledgeBroadcast,
  deleteBroadcast,
  getRealtimeDigest,
} from '../services/database.js';
import {
  registerSseClient,
  publishRealtimeEvent,
  publishTargetedBroadcastEvent,
  getRealtimeStats,
} from '../services/realtimeHub.js';
import {
  validateAndMergeKpiWorkflowForUnit,
  syncActiveFormWithPublishedSections,
  filterKpiWorkflowForCaller,
} from '../modules/kpi/kpiAccessPolicy.js';
import {
  validateAndMergeIkuSubmissionsForUnit,
} from '../modules/iku/ikuAccessPolicy.js';
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  dispatchWebPushToTargets,
} from '../services/webPushService.js';

const SUPERADMIN_ONLY_KEYS = new Set([
  'prp_kpi_config',
  'prp_kpi_validation_rules',
  'prp_periods',
  'prp_system_config',
  'prp_organization',
  'prp_users',
]);

const ALLOWED_SYNC_KEYS = new Set([
  ...SUPERADMIN_ONLY_KEYS,
  'prp_kpi_distribution_v1',
  'prp_iku_submissions_v1',
  'prp_notifications_v1',
  'prp_email_outbox_v1',
  'prp_spi_audit_v1',
]);

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function safeDecodeURIComponent(raw) {
  try {
    return decodeURIComponent(String(raw ?? ''));
  } catch {
    throw Object.assign(new Error('Parameter URL tidak valid.'), { status: 400 });
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(Object.assign(new Error('Ukuran payload melebihi batas maksimum keamanan (6 MB).'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(raw);
        resolve(sanitizePayload(parsed));
      } catch {
        reject(Object.assign(new Error('Format JSON tidak valid.'), { status: 400 }));
      }
    });
    req.on('error', (err) => {
      if (!tooLarge) reject(err);
    });
  });
}

function resolveAuthenticatedUser(req, urlObj) {
  const token = extractTokenFromRequest(req, urlObj);
  if (!token) return null;
  const claims = verifyAccessToken(token);
  if (!claims || !isSessionActive(claims.jti)) return null;
  const dbUser = findUserByEmail(claims.sub);
  if (!dbUser || dbUser.status === 'Nonaktif') return null;
  const { passwordHash: _ignored, ...safeUser } = dbUser;
  return { ...safeUser, jti: claims.jti };
}

export async function handleApiRequest(req, res) {
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  let urlObj;
  try {
    urlObj = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Format URL permintaan tidak valid.' });
    return true;
  }
  const pathname = urlObj.pathname;
  if (!pathname.startsWith('/api/v1')) {
    return false;
  }

  const ip = getClientIp(req);
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || 'GET');

  // Endpoint SSE Stream ditangani dengan batas koneksi per IP sendiri
  if (pathname === '/api/v1/realtime/stream' && req.method === 'GET') {
    const caller = resolveAuthenticatedUser(req, urlObj);
    if (!caller) {
      sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk membuka aliran realtime.' });
      return true;
    }
    registerSseClient(req, res, caller, ip);
    return true;
  }

  const slot = acquireRequestSlot(ip, isMutation);
  res.setHeader('X-RateLimit-Limit', String(slot.limit));
  res.setHeader('X-RateLimit-Remaining', String(slot.remaining));
  res.setHeader('X-RateLimit-Reset', String(slot.resetSec));

  if (!slot.allowed) {
    res.setHeader('Retry-After', String(slot.retryAfterSec));
    sendJson(res, slot.status, {
      ok: false,
      error: slot.reason,
      retryAfterSec: slot.retryAfterSec,
    });
    return true;
  }

  try {
    if (pathname === '/api/v1/health' && req.method === 'GET') {
      const chain = verifyAuditChain();
      sendJson(res, 200, {
        ok: true,
        service: 'performa-itpln-backend',
        version: '1.0.0',
        database: 'sqlite-wal-acid',
        auditChain: chain,
        realtime: getRealtimeStats(),
        rateLimiter: getRateLimiterTelemetry(),
        serverTime: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === '/api/v1/openapi.json' && req.method === 'GET') {
      const specPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../openapi.json');
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      sendJson(res, 200, spec);
      return true;
    }

    if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        sendJson(res, 400, { ok: false, error: 'Email dan kata sandi wajib diisi.' });
        return true;
      }

      const lockStatus = checkLoginLockout(ip, email);
      if (lockStatus.locked) {
        res.setHeader('Retry-After', String(lockStatus.retryAfterSec));
        appendAuditLog('LOGIN_TERKUNCI', `Brute-force shield menahan login ${email}`, email, ip);
        sendJson(res, 429, {
          ok: false,
          error: lockStatus.message,
          retryAfterSec: lockStatus.retryAfterSec,
        });
        return true;
      }

      const authResult = verifyUserCredentials(email, password);
      if (!authResult.ok) {
        const failInfo = recordLoginFailure(ip, email);
        appendAuditLog('LOGIN_GAGAL', `Login gagal (${authResult.reason}) percobaan ke-${failInfo.failures}`, email, ip);
        const status = authResult.reason === 'USER_INACTIVE' ? 403 : 401;
        sendJson(res, status, {
          ok: false,
          error: authResult.reason === 'USER_INACTIVE'
            ? 'Akun ini sedang dinonaktifkan oleh Administrator PRP.'
            : 'Kredensial tidak valid. Periksa kembali email kerja dan kata sandi Anda.',
          remainingAttempts: Math.max(0, 5 - failInfo.failures),
        });
        return true;
      }

      clearLoginFailures(ip, email);
      const { token, payload } = signAccessToken(authResult.user);
      createSessionRecord({
        jti: payload.jti,
        email: authResult.user.email,
        role: authResult.user.role,
        ip,
        userAgent: req.headers?.['user-agent'] || '',
        expiresAt: payload.exp,
      });

      appendAuditLog('LOGIN_BERHASIL', `Otoritas ${authResult.user.role} (${authResult.user.unit || authResult.user.name}) berhasil masuk`, authResult.user.email, ip);

      const cookieValue = `performa_access_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`;
      sendJson(
        res,
        200,
        {
          ok: true,
          accessToken: token,
          expiresAt: payload.exp * 1000,
          user: authResult.user,
        },
        { 'Set-Cookie': cookieValue },
      );
      return true;
    }

    if (pathname === '/api/v1/auth/logout' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (caller?.jti) {
        revokeSessionRecord(caller.jti);
        appendAuditLog('LOGOUT_SESI', `Sesi ditutup oleh ${caller.email}`, caller.email, ip);
      }
      sendJson(
        res,
        200,
        { ok: true },
        { 'Set-Cookie': 'performa_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' },
      );
      return true;
    }

    if (pathname === '/api/v1/auth/me' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Sesi belum terautentikasi.' });
        return true;
      }
      sendJson(res, 200, { ok: true, user: caller });
      return true;
    }

    if (pathname === '/api/v1/auth/profile' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk memperbarui profil.' });
        return true;
      }
      const body = await readJsonBody(req);
      const updatedUser = updateUserProfileByEmail(caller.email, body || {});
      if (!updatedUser) {
        sendJson(res, 404, { ok: false, error: 'Akun pengguna tidak ditemukan.' });
        return true;
      }
      const syncedUsers = listAllUsers();
      writeKvStore('prp_users', syncedUsers, caller.email);
      publishRealtimeEvent('state:updated', {
        updatedKeys: ['prp_users'],
        actor: { email: caller.email, name: updatedUser.name, role: updatedUser.role, picCodes: updatedUser.picCodes },
        stores: { prp_users: syncedUsers },
        users: syncedUsers,
        audit: listAuditLogs(40),
        at: new Date().toISOString(),
      });
      sendJson(res, 200, { ok: true, user: updatedUser });
      return true;
    }

    if (pathname === '/api/v1/auth/password' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk mengubah kata sandi.' });
        return true;
      }
      const body = await readJsonBody(req);
      const newPassword = String(body?.newPassword || '');
      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const sysConfig = readKvStore('prp_system_config', {}).value || {};
      const minLen = Number(sysConfig.minimumPasswordLength ?? sysConfig.passwordMinLength) || 8;
      if (newPassword.length < minLen) {
        sendJson(res, 400, { ok: false, error: `Kata sandi baru minimal ${minLen} karakter.` });
        return true;
      }
      if (!currentPassword && !caller.mustChangePassword) {
        sendJson(res, 400, { ok: false, error: 'Kata sandi saat ini wajib diisi.' });
        return true;
      }
      if (currentPassword) {
        const verified = verifyUserCredentials(caller.email, currentPassword);
        if (!verified.ok) {
          sendJson(res, 403, { ok: false, error: 'Kata sandi saat ini tidak sesuai.' });
          return true;
        }
      }
      const updatedUser = changeUserPasswordByEmail(caller.email, newPassword, caller.jti);
      const syncedUsers = listAllUsers();
      writeKvStore('prp_users', syncedUsers, caller.email);
      sendJson(res, 200, { ok: true, user: updatedUser });
      return true;
    }

    if (pathname === '/api/v1/bootstrap' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk memuat data sistem.' });
        return true;
      }
      const { stores, meta } = readAllKvStores();
      const users = listAllUsers();
      const safeStores = { ...stores };
      if (Array.isArray(safeStores.prp_users)) {
        safeStores.prp_users = users;
      }
      if (safeStores.prp_kpi_distribution_v1) {
        safeStores.prp_kpi_distribution_v1 = filterKpiWorkflowForCaller(safeStores.prp_kpi_distribution_v1, caller);
      }
      if (['superadmin_prp', 'spi'].includes(caller.role)) {
        safeStores.prp_spi_audit_v1 = readSpiAuditRecords();
      } else {
        delete safeStores.prp_spi_audit_v1;
      }
      const broadcasts = listBroadcastsForUser(caller);
      const rawAudit = listAuditLogs(200);
      const audit = ['superadmin_prp', 'spi'].includes(caller.role)
        ? rawAudit
        : rawAudit.filter((entry) => String(entry.actor || '').toLowerCase() === caller.email.toLowerCase());
      sendJson(res, 200, {
        ok: true,
        authenticatedAs: { email: caller.email, role: caller.role, picCodes: caller.picCodes },
        stores: safeStores,
        meta,
        users,
        broadcasts,
        audit,
        serverTime: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === '/api/v1/realtime/digest' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk memeriksa digest realtime.' });
        return true;
      }
      const digest = getRealtimeDigest(caller);
      sendJson(
        res,
        200,
        {
          ok: true,
          authenticatedAs: { email: caller.email, role: caller.role, picCodes: caller.picCodes },
          ...digest,
        },
        { 'Cache-Control': 'no-store, max-age=0' },
      );
      return true;
    }

    if (pathname === '/api/v1/notifications/email' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk mencatat pengiriman email.' });
        return true;
      }
      if (caller.role === 'spi') {
        sendJson(res, 403, { ok: false, error: 'Akun Auditor SPI bersifat Hanya Lihat (Read-Only).' });
        return true;
      }
      const body = (await readJsonBody(req)) || {};
      const rawRecipients = Array.isArray(body.toEmails)
        ? body.toEmails
        : (Array.isArray(body.recipients) ? body.recipients : []);
      const recipients = rawRecipients.filter(Boolean).slice(0, 30);
      const subject = String(body.subject || '[PERFORMA ITPLN] Pemberitahuan Sistem Kinerja').slice(0, 200);
      const textBody = String(body.body || '').slice(0, 4000);
      const mailId = String(body.id || `mail_${Date.now()}`);
      const recordedAt = new Date().toISOString();

      let deliveryStatus = 'QUEUED_OUTBOX_LOCAL';
      const resendKey = String(process.env.RESEND_API_KEY || '').trim();
      const webhookUrl = String(process.env.SMTP_WEBHOOK_URL || '').trim();
      const fromAddress = String(process.env.SMTP_FROM_EMAIL || 'performa-prp@itpln.ac.id').trim();

      if (recipients.length > 0 && typeof fetch === 'function') {
        if (resendKey) {
          try {
            const gwRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: fromAddress,
                to: recipients,
                subject,
                text: textBody || subject,
              }),
              signal: AbortSignal.timeout(8000),
            });
            deliveryStatus = gwRes.ok ? 'SENT_GATEWAY' : 'FAILED_GATEWAY';
          } catch {
            deliveryStatus = 'FAILED_GATEWAY';
          }
        } else if (webhookUrl) {
          try {
            const gwRes = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: mailId, from: fromAddress, to: recipients, subject, body: textBody, recordedAt }),
              signal: AbortSignal.timeout(8000),
            });
            deliveryStatus = gwRes.ok ? 'SENT_GATEWAY' : 'FAILED_GATEWAY';
          } catch {
            deliveryStatus = 'FAILED_GATEWAY';
          }
        }
      }

      const existingOutbox = readKvStore('prp_email_outbox_v1', []).value;
      const outboxStatus = deliveryStatus === 'SENT_GATEWAY'
        ? 'TERKIRIM_GATEWAY'
        : (deliveryStatus === 'FAILED_GATEWAY' ? 'GAGAL_GATEWAY' : 'TERCATAT_OUTBOX_AUDIT');
      const outboxEntry = {
        id: mailId,
        kind: String(body.kind || 'SYSTEM'),
        toEmails: recipients,
        recipientLabel: String(body.recipientLabel || recipients.join(', ') || 'Unit Terkait'),
        subject,
        body: textBody,
        actionUrl: String(body.actionUrl || '/internal'),
        actorEmail: caller.email,
        status: outboxStatus,
        deliveryStatus,
        sentAt: recordedAt,
      };
      const nextOutbox = [
        outboxEntry,
        ...(Array.isArray(existingOutbox) ? existingOutbox.filter((item) => item?.id !== mailId) : []),
      ].slice(0, 250);
      writeKvStore('prp_email_outbox_v1', nextOutbox, caller.email);

      appendAuditLog(
        'EMAIL_AUDIT_DISPATCH',
        `Email "${subject}" (${deliveryStatus}) untuk ${recipients.join(', ') || body.recipientLabel || 'unit terkait'}`,
        caller.email,
        ip,
      );
      if (deliveryStatus === 'FAILED_GATEWAY') {
        sendJson(res, 502, {
          ok: false,
          error: 'Gagal mengirim email melalui gateway eksternal, namun pesan telah dicatat pada outbox audit.',
          id: mailId,
          recipients,
          deliveryStatus,
          recordedAt,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        id: mailId,
        recipients,
        deliveryStatus,
        recordedAt,
      });
      return true;
    }

    if (pathname === '/api/v1/spi/audit' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk memuat data audit SPI.' });
        return true;
      }
      if (!['spi', 'superadmin_prp'].includes(caller.role)) {
        sendJson(res, 403, { ok: false, error: 'Akses ditolak: Hanya SPI dan Renbang (PRP) yang dapat membaca catatan audit SPI.' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        spiAudit: readSpiAuditRecords(),
        serverTime: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === '/api/v1/spi/audit' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk menyimpan catatan audit SPI.' });
        return true;
      }
      if (caller.role !== 'spi') {
        appendAuditLog(
          'SECURITY_VIOLATION',
          `Percobaan pengisian form/kolom khusus SPI oleh peran ${caller.role} (${caller.email}) ditolak.`,
          caller.email,
          ip,
        );
        sendJson(res, 403, {
          ok: false,
          error: 'Akses ditolak: Hanya akun Auditor SPI yang berhak mengisi bagian/kolom khusus milik SPI.',
        });
        return true;
      }
      const body = await readJsonBody(req);
      const itemKeys = Object.keys(body.items || {});
      const invalidKeys = itemKeys.filter((k) => k !== 'D_5');
      if (invalidKeys.length > 0) {
        appendAuditLog(
          'SECURITY_VIOLATION',
          `Percobaan pengisian indikator ${invalidKeys.join(', ')} di luar Bagian D.5 oleh SPI (${caller.email}) ditolak.`,
          caller.email,
          ip,
        );
        sendJson(res, 403, {
          ok: false,
          error: 'Akses ditolak: Akun SPI hanya dapat mengisi Bagian D No. 5: Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS).',
        });
        return true;
      }

      const clientId = String(req.headers?.['x-client-id'] || body.clientId || '');
      const formId = String(body.formId || 'global').trim();
      const savedEntry = upsertSpiAuditRecord(formId, body, caller.email, ip);
      if (!savedEntry) {
        sendJson(res, 400, { ok: false, error: 'Identitas formulir audit SPI tidak valid.' });
        return true;
      }
      const fullSpiAudit = readSpiAuditRecords();

      // Sinkronkan juga isian Bagian D.5 milik SPI ke prp_kpi_distribution_v1 secara real-time (terisolasi khusus D_5)
      let latestDist = readKvStore('prp_kpi_distribution_v1', null).value;
      const d5Item = savedEntry?.items?.D_5 || null;
      if (d5Item && formId && formId !== 'global') {
        const currentDist = latestDist || {
          forms: [],
          submissions: {},
          evidence: {},
          drafts: {},
          adminOverrides: {},
          revisions: {},
        };
        const spiSubKey = `${formId}:${caller.email.toLowerCase()}`;
        const prevSub = currentDist.submissions?.[spiSubKey] || null;
        const prevDraft = currentDist.drafts?.[spiSubKey] || null;
        const unVal = d5Item.unfollowedCount !== undefined ? String(d5Item.unfollowedCount) : (prevDraft?.values?.d_5_un ?? prevSub?.values?.d_5_un ?? '');
        const totVal = d5Item.totalRecommendations !== undefined ? String(d5Item.totalRecommendations) : (prevDraft?.values?.d_5_tot ?? prevSub?.values?.d_5_tot ?? '');
        const noteText = d5Item.auditNote !== undefined ? String(d5Item.auditNote) : (prevDraft?.notes?.D_5 ?? prevSub?.notes?.D_5 ?? '');
        const unNum = Number(unVal);
        const totNum = Number(totVal);
        const hasValidNums = String(unVal).trim() !== '' && String(totVal).trim() !== '' && Number.isFinite(unNum) && Number.isFinite(totNum) && totNum > 0;
        const unRatio = hasValidNums ? Math.min(1, Math.max(0, unNum / totNum)) : 0;

        const targetForm = (currentDist.forms || []).find((f) => String(f?.id) === formId);
        let d5Weight = -2.5;
        if (targetForm && Array.isArray(targetForm.sections)) {
          for (const sec of targetForm.sections) {
            const d5Config = (sec.items || []).find((it) => it?.id === 'D_5');
            if (d5Config && Number.isFinite(Number(d5Config.weight))) {
              d5Weight = Number(d5Config.weight);
              break;
            }
          }
        }
        const weightedD5 = hasValidNums ? Number((unRatio * d5Weight).toFixed(4)) : 0;
        const isDraftMode = Boolean(body.isDraft || d5Item.isDraft || d5Item.status === 'DRAFT');

        const nextDist = {
          ...currentDist,
          submissions: { ...(currentDist.submissions || {}) },
          drafts: { ...(currentDist.drafts || {}) },
          evidence: { ...(currentDist.evidence || {}) },
        };

        if (isDraftMode && (!prevSub || prevSub.status === 'DRAFT' || prevSub.status === 'REVISION_REQUESTED')) {
          nextDist.drafts[spiSubKey] = {
            ...(prevDraft || {}),
            formId,
            email: caller.email.toLowerCase(),
            unit: caller.unit || 'Satuan Pengawasan Intern (SPI)',
            picCodes: ['SPI'],
            values: {
              d_5_un: unVal,
              d_5_tot: totVal,
            },
            notes: noteText ? { D_5: noteText } : {},
            updatedAt: new Date().toISOString(),
          };
        } else {
          const nextSpiSub = {
            ...(prevSub || {}),
            formId,
            email: caller.email.toLowerCase(),
            unit: caller.unit || 'Satuan Pengawasan Intern (SPI)',
            picCodes: ['SPI'],
            assignedIndicatorIds: ['D_5'],
            values: {
              d_5_un: unVal,
              d_5_tot: totVal,
            },
            notes: noteText ? { D_5: noteText } : {},
            status: prevSub?.status && prevSub.status !== 'DRAFT' ? prevSub.status : 'SUBMITTED',
            submittedAt: new Date().toISOString(),
            sectionScores: [{ code: 'D', title: 'PERSPEKTIF KEPATUHAN (COMPLIANCE)', score: weightedD5 }],
            totalScore: weightedD5,
          };
          nextDist.submissions[spiSubKey] = nextSpiSub;
        }

        if (Array.isArray(d5Item.evidenceList)) {
          nextDist.evidence[spiSubKey] = d5Item.evidenceList.filter((ev) => ev && ev.indicatorId === 'D_5');
        }
        writeKvStore('prp_kpi_distribution_v1', nextDist, caller.email);
        latestDist = nextDist;
      }

      const updatedStoresPayload = { prp_spi_audit_v1: fullSpiAudit };
      const updatedKeysList = ['prp_spi_audit_v1'];
      if (latestDist) {
        updatedStoresPayload.prp_kpi_distribution_v1 = latestDist;
        updatedKeysList.push('prp_kpi_distribution_v1');
      }

      publishRealtimeEvent('state:updated', {
        updatedKeys: updatedKeysList,
        actor: { email: caller.email, name: caller.name, role: caller.role, picCodes: caller.picCodes },
        originClientId: clientId,
        stores: updatedStoresPayload,
        audit: listAuditLogs(80),
        at: new Date().toISOString(),
      });

      sendJson(res, 200, {
        ok: true,
        record: savedEntry,
        spiAudit: fullSpiAudit,
        serverTime: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === '/api/v1/sync/push' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk menyinkronkan data ke server pusat.' });
        return true;
      }

      const body = await readJsonBody(req);
      const incomingStores = body.stores && typeof body.stores === 'object' ? body.stores : {};
      const expectedVersions = body.expectedVersions && typeof body.expectedVersions === 'object' ? body.expectedVersions : {};
      const clientId = String(req.headers?.['x-client-id'] || body.clientId || '');
      const updatedKeys = [];
      const pendingPushNotifications = [];

      if (caller.role === 'spi') {
        const storeKeys = Object.keys(incomingStores);
        const spiEmailSuffix = `:${caller.email.toLowerCase()}`;
        const hasValidSpiDist = (() => {
          const dist = incomingStores.prp_kpi_distribution_v1;
          if (!dist || typeof dist !== 'object') return false;
          const allEntryKeys = [
            ...Object.keys(dist.drafts || {}),
            ...Object.keys(dist.submissions || {}),
            ...Object.keys(dist.evidence || {}),
          ];
          return allEntryKeys.some((k) => k.toLowerCase().endsWith(spiEmailSuffix));
        })();
        const isAllowedForSpi = storeKeys.length > 0 && storeKeys.every(
          (k) => k === 'prp_spi_audit_v1' || (k === 'prp_kpi_distribution_v1' && hasValidSpiDist),
        );
        if (!isAllowedForSpi) {
          const attemptedKeys = storeKeys.join(', ') || 'state';
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan ubah data ${attemptedKeys} di luar cakupan SPI oleh akun Auditor SPI (${caller.email})`,
            caller.email,
            ip,
          );
          sendJson(res, 403, {
            ok: false,
            error: 'Akun Auditor SPI hanya dapat mengisi bagian/kolom audit khusus miliknya sendiri (Bagian D.5) dan dilarang mengubah data Renbang maupun unit lain.',
          });
          return true;
        }
      }

      const db = getDatabase();
      db.exec('SAVEPOINT sp_sync_push');
      try {
        for (const [storeKey, incomingVal] of Object.entries(incomingStores)) {
          if (!ALLOWED_SYNC_KEYS.has(storeKey)) continue;

          if (storeKey === 'prp_spi_audit_v1') {
            if (caller.role !== 'spi') {
              db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
              db.exec('RELEASE SAVEPOINT sp_sync_push');
              appendAuditLog(
                'SECURITY_VIOLATION',
                `Percobaan tulis bagian khusus SPI (prp_spi_audit_v1) oleh non-SPI (${caller.email})`,
                caller.email,
                ip,
              );
              sendJson(res, 403, {
                ok: false,
                error: 'Akses ditolak: Hanya akun Auditor SPI yang berhak mengisi bagian/kolom khusus SPI.',
              });
              return true;
            }
            const byForm = (incomingVal?.records && typeof incomingVal.records === 'object'
              ? incomingVal.records
              : incomingVal?.byForm) || {};
            for (const [fId, formEntry] of Object.entries(byForm)) {
              if (fId && formEntry && typeof formEntry === 'object') {
                const invalidKeys = Object.keys(formEntry.items || {}).filter((k) => k !== 'D_5');
                if (invalidKeys.length > 0) {
                  db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
                  db.exec('RELEASE SAVEPOINT sp_sync_push');
                  appendAuditLog(
                    'SECURITY_VIOLATION',
                    `Percobaan pengisian indikator ${invalidKeys.join(', ')} di luar Bagian D.5 melalui sync/push oleh SPI (${caller.email}) ditolak.`,
                    caller.email,
                    ip,
                  );
                  sendJson(res, 403, {
                    ok: false,
                    error: 'Akses ditolak: Akun SPI hanya dapat mengisi Bagian D No. 5: Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS).',
                  });
                  return true;
                }
                upsertSpiAuditRecord(fId, formEntry, caller.email, ip);
              }
            }
            updatedKeys.push('prp_spi_audit_v1');
            continue;
          }

          if (storeKey === 'prp_notifications_v1' || storeKey === 'prp_email_outbox_v1') {
            if (Array.isArray(incomingVal)) {
              const existingList = readKvStore(storeKey, []).value;
              const mergedMap = new Map();
              (Array.isArray(existingList) ? existingList : []).forEach((item) => {
                if (item?.id) mergedMap.set(item.id, item);
              });
              const newNotificationItems = [];
              incomingVal.forEach((item) => {
                if (!item?.id) return;
                const prev = mergedMap.get(item.id);
                if (!prev) {
                  mergedMap.set(item.id, item);
                  if (storeKey === 'prp_notifications_v1') {
                    newNotificationItems.push(item);
                  }
                } else {
                  const readBy = Array.from(new Set([
                    ...(Array.isArray(prev.readBy) ? prev.readBy : []),
                    ...(Array.isArray(item.readBy) ? item.readBy : []),
                  ]));
                  mergedMap.set(item.id, { ...prev, ...item, readBy });
                }
              });
              const mergedList = Array.from(mergedMap.values())
                .sort((a, b) => String(b.createdAt || b.sentAt || '').localeCompare(String(a.createdAt || a.sentAt || '')))
                .slice(0, 250);
              const result = writeKvStore(storeKey, mergedList, caller.email);
              if (result.changed) {
                updatedKeys.push(storeKey);
              }
              if (newNotificationItems.length > 0) {
                pendingPushNotifications.push(...newNotificationItems.slice(0, 5));
              }
            }
            continue;
          }

          if (SUPERADMIN_ONLY_KEYS.has(storeKey)) {
            if (caller.role !== 'superadmin_prp') {
              db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
              db.exec('RELEASE SAVEPOINT sp_sync_push');
              appendAuditLog(
                'SECURITY_VIOLATION',
                `Percobaan tulis store ${storeKey} oleh non-superadmin (${caller.email})`,
                caller.email,
                ip,
              );
              sendJson(res, 403, {
                ok: false,
                error: `Akses ditolak: Hanya Superadmin PRP yang berwenang mengubah konfigurasi ${storeKey}.`,
              });
              return true;
            }
            let valueToPersist = incomingVal;
            if (storeKey === 'prp_users' && Array.isArray(incomingVal)) {
              valueToPersist = syncUsersListFromAdmin(incomingVal, caller.email);
            }
            const result = writeKvStore(storeKey, valueToPersist, caller.email);
            if (result.changed) {
              updatedKeys.push(storeKey);
              appendAuditLog('SYNC_CONFIG_PRP', `Pembaruan ${storeKey} (v${result.version})`, caller.email, ip);
            }
            // Sinkronkan juga sections di prp_kpi_distribution_v1 apabila prp_kpi_config diperbarui dan tidak disertakan di request yang sama
            if (storeKey === 'prp_kpi_config' && Array.isArray(incomingVal?.sections) && !incomingStores.prp_kpi_distribution_v1) {
              const existingWorkflow = readKvStore('prp_kpi_distribution_v1', null).value;
              const syncedWorkflow = syncActiveFormWithPublishedSections(existingWorkflow, incomingVal.sections, caller.email);
              if (syncedWorkflow) {
                const wfRes = writeKvStore('prp_kpi_distribution_v1', syncedWorkflow, caller.email);
                if (wfRes.changed && !updatedKeys.includes('prp_kpi_distribution_v1')) {
                  updatedKeys.push('prp_kpi_distribution_v1');
                }
              }
            }
            continue;
          }

          if (storeKey === 'prp_kpi_distribution_v1') {
            if (caller.role === 'superadmin_prp') {
              let valueToWrite = incomingVal;
              const existingRecord = readKvStore(storeKey, null);
              const expectedVer = Number(expectedVersions[storeKey]);
              if (
                existingRecord?.value
                && typeof existingRecord.value === 'object'
                && incomingVal
                && typeof incomingVal === 'object'
                && Number.isFinite(expectedVer)
                && expectedVer > 0
                && existingRecord.version > expectedVer
              ) {
                valueToWrite = {
                  ...existingRecord.value,
                  ...incomingVal,
                  submissions: { ...(existingRecord.value.submissions || {}), ...(incomingVal.submissions || {}) },
                  evidence: { ...(existingRecord.value.evidence || {}), ...(incomingVal.evidence || {}) },
                  drafts: { ...(existingRecord.value.drafts || {}), ...(incomingVal.drafts || {}) },
                };
              }
              const result = writeKvStore(storeKey, valueToWrite, caller.email);
              if (result.changed) {
                updatedKeys.push(storeKey);
                appendAuditLog('KPI_WORKFLOW_PRP', `Sinkronisasi workflow KPI oleh Superadmin PRP (v${result.version})`, caller.email, ip);
              }
            } else if (caller.role === 'kpi_only' || caller.role === 'dual' || caller.role === 'spi') {
              const existing = readKvStore(storeKey, null).value;
              const merged = validateAndMergeKpiWorkflowForUnit(existing, incomingVal, caller, ip);
              const result = writeKvStore(storeKey, merged, caller.email);
              if (result.changed) {
                updatedKeys.push(storeKey);
                appendAuditLog(
                  'KPI_UNIT_SYNC',
                  `Sinkronisasi capaian/bukti KPI unit ${caller.unit || caller.email} (PIC: ${(caller.picCodes || []).join(', ') || caller.role.toUpperCase()})`,
                  caller.email,
                  ip,
                );
              }
            } else {
              db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
              db.exec('RELEASE SAVEPOINT sp_sync_push');
              sendJson(res, 403, { ok: false, error: 'Akun khusus IKU tidak memiliki akses tulis pada lembar kerja KPI.' });
              return true;
            }
            continue;
          }

          if (storeKey === 'prp_iku_submissions_v1') {
            if (caller.role === 'superadmin_prp') {
              const result = writeKvStore(storeKey, incomingVal, caller.email);
              if (result.changed) {
                updatedKeys.push(storeKey);
                appendAuditLog('IKU_WORKFLOW_PRP', `Sinkronisasi submission IKU oleh Superadmin PRP (v${result.version})`, caller.email, ip);
              }
            } else if (caller.role === 'iku_only' || caller.role === 'dual') {
              const existing = readKvStore(storeKey, []).value;
              const merged = validateAndMergeIkuSubmissionsForUnit(existing, incomingVal, caller, ip);
              const result = writeKvStore(storeKey, merged, caller.email);
              if (result.changed) {
                updatedKeys.push(storeKey);
                appendAuditLog('IKU_UNIT_SYNC', `Sinkronisasi capaian 8 IKU oleh ${caller.email}`, caller.email, ip);
              }
            } else {
              db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
              db.exec('RELEASE SAVEPOINT sp_sync_push');
              sendJson(res, 403, { ok: false, error: 'Akun unit KPI tidak memiliki akses tulis pada pengajuan IKU.' });
              return true;
            }
          }
        }
        db.exec('RELEASE SAVEPOINT sp_sync_push');
      } catch (err) {
        try {
          db.exec('ROLLBACK TO SAVEPOINT sp_sync_push');
          db.exec('RELEASE SAVEPOINT sp_sync_push');
        } catch {
          // Abaikan bila savepoint sudah ditutup
        }
        throw err;
      }

      if (pendingPushNotifications.length > 0) {
        pendingPushNotifications.forEach((notif) => {
          dispatchWebPushToTargets(
            {
              id: notif.id,
              title: notif.title || 'Notifikasi PERFORMA ITPLN',
              body: notif.message || 'Terdapat pembaruan status pada portal kinerja.',
              actionUrl: notif.actionUrl || '/internal',
              actionLabel: 'Buka Portal',
              tag: `prp-notif-${notif.id}`,
            },
            {
              targetType: notif.targetType || '',
              targetValue: notif.targetValue || '',
              emailRecipients: Array.isArray(notif.emailRecipients) ? notif.emailRecipients : [],
              targetEmails: Array.isArray(notif.targetEmails) ? notif.targetEmails : [],
              targetRoles: Array.isArray(notif.targetRoles) ? notif.targetRoles : [],
              targetPicCodes: Array.isArray(notif.targetPicCodes) ? notif.targetPicCodes : [],
            },
          ).catch(() => {});
        });
      }

      const { stores, meta } = readAllKvStores();
      if (updatedKeys.length > 0) {
        publishRealtimeEvent('state:updated', {
          updatedKeys,
          actor: { email: caller.email, name: caller.name, role: caller.role, picCodes: caller.picCodes },
          originClientId: clientId,
          stores: Object.fromEntries(updatedKeys.map((k) => [k, stores[k]])),
          users: updatedKeys.includes('prp_users') ? listAllUsers() : undefined,
          audit: listAuditLogs(80),
          at: new Date().toISOString(),
        });
      }

      const responseStores = { ...stores };
      if (responseStores.prp_kpi_distribution_v1) {
        responseStores.prp_kpi_distribution_v1 = filterKpiWorkflowForCaller(responseStores.prp_kpi_distribution_v1, caller);
      }
      if (['superadmin_prp', 'spi'].includes(caller.role)) {
        responseStores.prp_spi_audit_v1 = readSpiAuditRecords();
      } else {
        delete responseStores.prp_spi_audit_v1;
      }

      sendJson(res, 200, {
        ok: true,
        updatedKeys,
        stores: responseStores,
        meta,
        audit: listAuditLogs(80),
        serverTime: new Date().toISOString(),
      });
      return true;
    }

    if (pathname === '/api/v1/broadcasts' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      const list = listBroadcastsForUser(caller);
      sendJson(res, 200, { ok: true, broadcasts: list });
      return true;
    }

    if (pathname === '/api/v1/broadcasts' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller || caller.role !== 'superadmin_prp') {
        appendAuditLog('SECURITY_VIOLATION', `Percobaan kirim broadcast tanpa otoritas Superadmin oleh ${caller?.email || 'anonim'}`, caller?.email || 'anonim', ip);
        sendJson(res, 403, { ok: false, error: 'Hanya Superadmin PRP yang berwenang mengirim siaran instruksi terpusat.' });
        return true;
      }

      const body = await readJsonBody(req);
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      if (!title || !message) {
        sendJson(res, 400, { ok: false, error: 'Judul dan isi pesan instruksi wajib diisi.' });
        return true;
      }

      const created = createBroadcast({
        title,
        message,
        priority: body.priority || 'IMPORTANT',
        targetType: body.targetType || 'ALL',
        targetValue: body.targetValue || '',
        actionUrl: body.actionUrl || '/internal',
        actionLabel: body.actionLabel || 'Buka Lembar Kerja',
        senderEmail: caller.email,
        senderName: caller.name || 'Superadmin PRP',
        expiresAt: body.expiresAt || null,
      });

      const deliveredCount = publishTargetedBroadcastEvent('broadcast:published', created);
      dispatchWebPushToTargets(
        {
          id: created.id,
          title: `[${created.priority || 'INFO'}] ${created.title}`,
          body: created.message,
          priority: created.priority,
          actionUrl: created.actionUrl || '/internal',
          actionLabel: created.actionLabel || 'Buka Lembar Kerja',
          tag: `prp-broadcast-${created.id}`,
        },
        {
          targetType: created.targetType || 'ALL',
          targetValue: created.targetValue || '',
        },
      ).catch(() => {});

      sendJson(res, 201, {
        ok: true,
        broadcast: created,
        deliveredRealtimeClients: deliveredCount,
      });
      return true;
    }

    const ackMatch = pathname.match(/^\/api\/v1\/broadcasts\/([^/]+)\/ack$/);
    if (ackMatch && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk mengonfirmasi siaran.' });
        return true;
      }
      const broadcastId = safeDecodeURIComponent(ackMatch[1]);
      const updated = acknowledgeBroadcast(broadcastId, caller);
      if (!updated) {
        sendJson(res, 404, { ok: false, error: 'Siaran tidak ditemukan.' });
        return true;
      }
      publishRealtimeEvent('broadcast:acknowledged', {
        broadcast: updated,
        acknowledgedBy: { email: caller.email, name: caller.name, unit: caller.unit },
        at: new Date().toISOString(),
      });
      sendJson(res, 200, { ok: true, broadcast: updated });
      return true;
    }

    const delMatch = pathname.match(/^\/api\/v1\/broadcasts\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller || caller.role !== 'superadmin_prp') {
        sendJson(res, 403, { ok: false, error: 'Hanya Superadmin PRP yang dapat menghentikan siaran.' });
        return true;
      }
      const broadcastId = safeDecodeURIComponent(delMatch[1]);
      const deleted = deleteBroadcast(broadcastId, caller.email);
      if (!deleted) {
        sendJson(res, 404, { ok: false, error: 'Siaran tidak ditemukan.' });
        return true;
      }
      publishRealtimeEvent('broadcast:deleted', { broadcastId, at: new Date().toISOString() });
      sendJson(res, 200, { ok: true, broadcastId });
      return true;
    }

    const delUserMatch = pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
    if (delUserMatch && req.method === 'DELETE') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller || caller.role !== 'superadmin_prp') {
        sendJson(res, 403, { ok: false, error: 'Hanya Superadmin PRP yang berwenang menghapus akun pengguna.' });
        return true;
      }
      const targetEmail = safeDecodeURIComponent(delUserMatch[1]).toLowerCase();
      if (targetEmail === caller.email.toLowerCase()) {
        sendJson(res, 400, { ok: false, error: 'Akun sendiri tidak dapat dihapus.' });
        return true;
      }
      const removed = deleteUserByEmail(targetEmail, caller.email);
      if (removed) {
        const syncedUsers = listAllUsers();
        writeKvStore('prp_users', syncedUsers, caller.email);
        publishRealtimeEvent('state:updated', {
          updatedKeys: ['prp_users'],
          actor: { email: caller.email, name: caller.name, role: caller.role },
          stores: { prp_users: syncedUsers },
          users: syncedUsers,
          audit: listAuditLogs(40),
          at: new Date().toISOString(),
        });
      }
      sendJson(res, 200, { ok: true, removed });
      return true;
    }

    if (pathname === '/api/v1/push/vapid-public-key' && req.method === 'GET') {
      const publicKey = getVapidPublicKey();
      sendJson(res, 200, { ok: true, publicKey });
      return true;
    }

    if (pathname === '/api/v1/push/subscribe' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk mendaftarkan langganan Web Push.' });
        return true;
      }
      const body = await readJsonBody(req);
      const subPayload = body?.subscription || body;
      const saved = savePushSubscription(
        {
          ...subPayload,
          userAgent: req.headers['user-agent'] || '',
        },
        caller,
      );
      sendJson(res, 201, {
        ok: true,
        subscription: {
          endpoint: saved.endpoint,
          email: saved.email,
          updatedAt: saved.updatedAt,
        },
      });
      return true;
    }

    if (pathname === '/api/v1/push/unsubscribe' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      const body = await readJsonBody(req);
      const endpoint = String(body?.endpoint || body?.subscription?.endpoint || '').trim();
      const removed = removePushSubscription(endpoint, caller?.email || 'client_unsubscribe');
      sendJson(res, 200, { ok: true, removed });
      return true;
    }

    sendJson(res, 404, { ok: false, error: `Endpoint API ${pathname} tidak ditemukan.` });
    return true;
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    sendJson(res, status, {
      ok: false,
      error: err?.message || 'Terjadi kesalahan internal pada server.',
    });
    return true;
  } finally {
    slot.release?.();
  }
}
