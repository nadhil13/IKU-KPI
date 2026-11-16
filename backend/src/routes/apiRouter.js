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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(Object.assign(new Error('Ukuran payload melebihi batas maksimum keamanan (6 MB).'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
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
    req.on('error', reject);
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

  const urlObj = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
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
    // 1. GET /api/v1/health
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

    // 2. POST /api/v1/auth/login
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

    // 3. POST /api/v1/auth/logout
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

    // 4. GET /api/v1/auth/me
    if (pathname === '/api/v1/auth/me' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Sesi belum terautentikasi.' });
        return true;
      }
      sendJson(res, 200, { ok: true, user: caller });
      return true;
    }

    // 4b. POST /api/v1/auth/profile (Pembaruan profil mandiri oleh pengguna terautentikasi)
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

    // 4c. POST /api/v1/auth/password (Pembaruan kata sandi mandiri oleh pengguna terautentikasi)
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
      const minLen = Number(sysConfig.passwordMinLength) || 8;
      if (newPassword.length < minLen) {
        sendJson(res, 400, { ok: false, error: `Kata sandi baru minimal ${minLen} karakter.` });
        return true;
      }
      if (!currentPassword) {
        sendJson(res, 400, { ok: false, error: 'Kata sandi saat ini wajib diisi.' });
        return true;
      }
      const verified = verifyUserCredentials(caller.email, currentPassword);
      if (!verified.ok) {
        sendJson(res, 403, { ok: false, error: 'Kata sandi saat ini tidak sesuai.' });
        return true;
      }
      const updatedUser = changeUserPasswordByEmail(caller.email, newPassword);
      sendJson(res, 200, { ok: true, user: updatedUser });
      return true;
    }

    // 5. GET /api/v1/bootstrap
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

    // 5b. GET /api/v1/realtime/digest (Ringan: cek perubahan versi state/broadcast di PWA & serverless)
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

    // 5c. POST /api/v1/notifications/email (Pengiriman gateway email resmi + rekam jejak audit)
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
      const body = sanitizePayload((await readJsonBody(req)) || {});
      const recipients = Array.isArray(body.toEmails) ? body.toEmails.filter(Boolean).slice(0, 30) : [];
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
            });
            deliveryStatus = gwRes.ok ? 'SENT_GATEWAY' : 'FAILED_GATEWAY';
          } catch {
            deliveryStatus = 'FAILED_GATEWAY';
          }
        }
      }

      const existingOutbox = readKvStore('prp_email_outbox_v1', []).value;
      const outboxEntry = {
        id: mailId,
        kind: String(body.kind || 'SYSTEM'),
        toEmails: recipients,
        recipientLabel: String(body.recipientLabel || recipients.join(', ') || 'Unit Terkait'),
        subject,
        body: textBody,
        actionUrl: String(body.actionUrl || '/internal'),
        actorEmail: caller.email,
        status: deliveryStatus === 'SENT_GATEWAY' ? 'TERKIRIM_GATEWAY' : 'TERCATAT_OUTBOX_AUDIT',
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
      sendJson(res, 200, {
        ok: true,
        id: mailId,
        recipients,
        deliveryStatus,
        recordedAt,
      });
      return true;
    }

    // 6. POST /api/v1/sync/push
    if (pathname === '/api/v1/sync/push' && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk menyinkronkan data ke server pusat.' });
        return true;
      }

      const body = await readJsonBody(req);
      const incomingStores = body.stores && typeof body.stores === 'object' ? body.stores : {};
      const clientId = String(req.headers?.['x-client-id'] || body.clientId || '');
      const updatedKeys = [];

      if (caller.role === 'spi') {
        const attemptedKeys = Object.keys(incomingStores).join(', ') || 'state';
        appendAuditLog(
          'SECURITY_VIOLATION',
          `Percobaan ubah data ${attemptedKeys} oleh akun Auditor SPI (${caller.email})`,
          caller.email,
          ip,
        );
        sendJson(res, 403, {
          ok: false,
          error: 'Akun Auditor SPI bersifat Hanya Lihat (Read-Only) dan tidak diizinkan mengubah data kinerja.',
        });
        return true;
      }

      for (const [storeKey, incomingVal] of Object.entries(incomingStores)) {
        if (!ALLOWED_SYNC_KEYS.has(storeKey)) continue;

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
              newNotificationItems.slice(0, 5).forEach((notif) => {
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
                    targetEmails: Array.isArray(notif.targetEmails) ? notif.targetEmails : [],
                    targetRoles: Array.isArray(notif.targetRoles) ? notif.targetRoles : [],
                    targetPicCodes: Array.isArray(notif.targetPicCodes) ? notif.targetPicCodes : [],
                  },
                ).catch(() => {});
              });
            }
          }
          continue;
        }

        if (SUPERADMIN_ONLY_KEYS.has(storeKey)) {
          if (caller.role !== 'superadmin_prp') {
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
            const result = writeKvStore(storeKey, incomingVal, caller.email);
            if (result.changed) {
              updatedKeys.push(storeKey);
              appendAuditLog('KPI_WORKFLOW_PRP', `Sinkronisasi workflow KPI oleh Superadmin PRP (v${result.version})`, caller.email, ip);
            }
          } else if (caller.role === 'kpi_only' || caller.role === 'dual') {
            const existing = readKvStore(storeKey, null).value;
            const merged = validateAndMergeKpiWorkflowForUnit(existing, incomingVal, caller, ip);
            const result = writeKvStore(storeKey, merged, caller.email);
            if (result.changed) {
              updatedKeys.push(storeKey);
              appendAuditLog(
                'KPI_UNIT_SYNC',
                `Sinkronisasi capaian/bukti KPI unit ${caller.unit || caller.email} (PIC: ${(caller.picCodes || []).join(', ')})`,
                caller.email,
                ip,
              );
            }
          } else {
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
            sendJson(res, 403, { ok: false, error: 'Akun unit KPI tidak memiliki akses tulis pada pengajuan IKU.' });
            return true;
          }
        }
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

    // 7. GET /api/v1/broadcasts
    if (pathname === '/api/v1/broadcasts' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      const list = listBroadcastsForUser(caller);
      sendJson(res, 200, { ok: true, broadcasts: list });
      return true;
    }

    // 8. POST /api/v1/broadcasts (Superadmin PRP)
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

    // 9. POST /api/v1/broadcasts/:id/ack
    const ackMatch = pathname.match(/^\/api\/v1\/broadcasts\/([^/]+)\/ack$/);
    if (ackMatch && req.method === 'POST') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller) {
        sendJson(res, 401, { ok: false, error: 'Autentikasi diperlukan untuk mengonfirmasi siaran.' });
        return true;
      }
      const broadcastId = decodeURIComponent(ackMatch[1]);
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

    // 10. DELETE /api/v1/broadcasts/:id (Superadmin PRP)
    const delMatch = pathname.match(/^\/api\/v1\/broadcasts\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller || caller.role !== 'superadmin_prp') {
        sendJson(res, 403, { ok: false, error: 'Hanya Superadmin PRP yang dapat menghentikan siaran.' });
        return true;
      }
      const broadcastId = decodeURIComponent(delMatch[1]);
      const deleted = deleteBroadcast(broadcastId, caller.email);
      if (!deleted) {
        sendJson(res, 404, { ok: false, error: 'Siaran tidak ditemukan.' });
        return true;
      }
      publishRealtimeEvent('broadcast:deleted', { broadcastId, at: new Date().toISOString() });
      sendJson(res, 200, { ok: true, broadcastId });
      return true;
    }

    // 11. DELETE /api/v1/users/:email (Superadmin PRP)
    const delUserMatch = pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
    if (delUserMatch && req.method === 'DELETE') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      if (!caller || caller.role !== 'superadmin_prp') {
        sendJson(res, 403, { ok: false, error: 'Hanya Superadmin PRP yang berwenang menghapus akun pengguna.' });
        return true;
      }
      const targetEmail = decodeURIComponent(delUserMatch[1]).toLowerCase();
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

    // 12. GET /api/v1/push/vapid-public-key
    if (pathname === '/api/v1/push/vapid-public-key' && req.method === 'GET') {
      const publicKey = getVapidPublicKey();
      sendJson(res, 200, { ok: true, publicKey });
      return true;
    }

    // 13. POST /api/v1/push/subscribe
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

    // 14. POST /api/v1/push/unsubscribe
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
