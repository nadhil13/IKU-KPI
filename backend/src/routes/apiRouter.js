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
} from '../services/database.js';
import {
  registerSseClient,
  publishRealtimeEvent,
  publishTargetedBroadcastEvent,
  getRealtimeStats,
} from '../services/realtimeHub.js';

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
]);

function normalizePicList(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/(?:,|\/|&|\bdan\b)+/i);
  const seen = new Set();
  const out = [];
  list.forEach((entry) => {
    const clean = String(entry ?? '').trim().toUpperCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  });
  return out;
}

function canCallerEditKpiRow(item, callerUser) {
  if (!callerUser || callerUser.status === 'Nonaktif') return false;
  if (callerUser.role === 'superadmin_prp') return true;
  if (callerUser.role !== 'kpi_only') return false;
  const rowPics = normalizePicList(item?.pics ?? item?.picDisplay ?? []);
  if (rowPics.length === 0) return false;
  const userPics = new Set(normalizePicList(callerUser.picCodes || []));
  return rowPics.some((code) => userPics.has(code));
}

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

function validateAndMergeKpiWorkflowForUnit(existingWorkflow, incomingWorkflow, callerUser, ip) {
  const callerEmail = callerUser.email.toLowerCase();
  const base = existingWorkflow && typeof existingWorkflow === 'object'
    ? existingWorkflow
    : { forms: [], submissions: {}, evidence: {}, drafts: {} };

  const incoming = incomingWorkflow && typeof incomingWorkflow === 'object'
    ? incomingWorkflow
    : { forms: [], submissions: {}, evidence: {}, drafts: {} };

  // Jika server belum memiliki form sama sekali, izinkan inisialisasi form default tanpa submission
  const forms = Array.isArray(base.forms) && base.forms.length > 0
    ? base.forms
    : (Array.isArray(incoming.forms) ? incoming.forms.slice(0, 2) : []);

  const nextSubmissions = { ...(base.submissions || {}) };
  const nextEvidence = { ...(base.evidence || {}) };
  const nextDrafts = { ...(base.drafts || {}) };

  const activeForm = forms[forms.length - 1];
  if (!activeForm) {
    return { forms, submissions: nextSubmissions, evidence: nextEvidence, drafts: nextDrafts };
  }

  const editableItemIds = new Set();
  const editableSubKeys = new Set();
  (activeForm.sections || []).forEach((sec) => {
    (sec.items || []).forEach((item) => {
      if (canCallerEditKpiRow(item, callerUser)) {
        editableItemIds.add(item.id);
        (item.subrows || []).forEach((sub) => editableSubKeys.add(sub.key));
      }
    });
  });

  // Cek apakah ada upaya memodifikasi key milik unit lain
  const checkForeignKeyTampering = (incomingMap, baseMap, mapLabel) => {
    for (const [entryKey, incomingVal] of Object.entries(incomingMap || {})) {
      const [, keyEmail] = String(entryKey).split(':');
      if (keyEmail && keyEmail.toLowerCase() !== callerEmail) {
        const prevJson = JSON.stringify(baseMap?.[entryKey] ?? null);
        const nextJson = JSON.stringify(incomingVal ?? null);
        if (prevJson !== nextJson) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan modifikasi ${mapLabel} lintas unit (${entryKey}) oleh ${callerEmail} ditolak.`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error(`Pelanggaran hak akses: Akun ${callerEmail} dilarang memodifikasi data milik unit lain (${keyKeyLabel(entryKey)}).`),
            { status: 403 },
          );
        }
      }
    }
  };

  checkForeignKeyTampering(incoming.submissions, base.submissions, 'submission KPI');
  checkForeignKeyTampering(incoming.evidence, base.evidence, 'bukti capaian KPI');
  checkForeignKeyTampering(incoming.drafts, base.drafts, 'draf KPI');

  // Proses seluruh form untuk key milik caller sendiri
  for (const form of forms) {
    const unitKey = `${form.id}:${callerEmail}`;

    // 1. Validasi Draf Unit
    if (incoming.drafts && Object.prototype.hasOwnProperty.call(incoming.drafts, unitKey)) {
      const rawDraft = incoming.drafts[unitKey];
      if (!rawDraft) {
        delete nextDrafts[unitKey];
      } else {
        const cleanValues = {};
        for (const [k, v] of Object.entries(rawDraft.values || {})) {
          if (!editableSubKeys.has(k) && String(v ?? '').trim() !== '') {
            appendAuditLog(
              'SECURITY_VIOLATION',
              `Percobaan pengisian draf pada sub-baris ${k} di luar otoritas PIC (${(callerUser.picCodes || []).join(',')}) oleh ${callerEmail}`,
              callerEmail,
              ip,
            );
            throw Object.assign(
              new Error(`Akses ditolak: Anda tidak memiliki hak input PIC pada kolom ${k}.`),
              { status: 403 },
            );
          }
          if (editableSubKeys.has(k)) cleanValues[k] = v;
        }
        const cleanNotes = {};
        for (const [itemId, noteText] of Object.entries(rawDraft.notes || {})) {
          if (editableItemIds.has(itemId)) cleanNotes[itemId] = String(noteText ?? '');
        }
        nextDrafts[unitKey] = {
          ...rawDraft,
          formId: form.id,
          email: callerEmail,
          picCodes: callerUser.picCodes || [],
          values: cleanValues,
          notes: cleanNotes,
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (incoming.drafts && !Object.prototype.hasOwnProperty.call(incoming.drafts, unitKey)) {
      delete nextDrafts[unitKey];
    }

    // 2. Validasi Evidence Unit per Baris
    if (incoming.evidence && Object.prototype.hasOwnProperty.call(incoming.evidence, unitKey)) {
      const rawEvList = Array.isArray(incoming.evidence[unitKey]) ? incoming.evidence[unitKey] : [];
      const prevEvById = new Map(((base.evidence && base.evidence[unitKey]) || []).map((e) => [e.id, e]));
      const cleanEvList = rawEvList.map((ev) => {
        if (!editableItemIds.has(ev.indicatorId)) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan unggah bukti pada indikator ${ev.indicatorId} milik PIC lain oleh ${callerEmail}`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error(`Akses ditolak: Indikator ${ev.indicatorId} bukan tanggung jawab PIC akun Anda.`),
            { status: 403 },
          );
        }
        const prevEv = prevEvById.get(ev.id);
        return {
          ...ev,
          owner: callerEmail,
          ownerUnit: callerUser.unit || callerUser.name,
          picCodes: callerUser.picCodes || [],
          // Unit tidak boleh memalsukan status VERIFIED sendiri
          status: prevEv?.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        };
      });
      nextEvidence[unitKey] = cleanEvList;
    }

    // 3. Validasi Submission Unit
    if (incoming.submissions && Object.prototype.hasOwnProperty.call(incoming.submissions, unitKey)) {
      const rawSub = incoming.submissions[unitKey];
      const prevSub = base.submissions?.[unitKey];
      if (rawSub) {
        // Cegah unit memalsukan status APPROVED / LOCKED sendiri
        if (['APPROVED', 'LOCKED'].includes(rawSub.status) && prevSub?.status !== rawSub.status) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan manipulasi status submission ke ${rawSub.status} oleh ${callerEmail}`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error('Pelanggaran keamanan: Hanya Superadmin PRP yang berhak menyetujui atau mengunci submission.'),
            { status: 403 },
          );
        }
        for (const [k, v] of Object.entries(rawSub.values || {})) {
          if (!editableSubKeys.has(k) && String(v ?? '').trim() !== '') {
            appendAuditLog(
              'SECURITY_VIOLATION',
              `Percobaan submit nilai pada sub-baris ${k} milik PIC lain oleh ${callerEmail}`,
              callerEmail,
              ip,
            );
            throw Object.assign(
              new Error(`Pelanggaran hak akses PIC: Anda tidak berhak mengisi sub-baris ${k}.`),
              { status: 403 },
            );
          }
        }
        nextSubmissions[unitKey] = {
          ...rawSub,
          email: callerEmail,
          picCodes: callerUser.picCodes || [],
        };
      }
    }
  }

  return {
    forms,
    submissions: nextSubmissions,
    evidence: nextEvidence,
    drafts: nextDrafts,
  };
}

function keyKeyLabel(entryKey) {
  const parts = String(entryKey).split(':');
  return parts[1] || entryKey;
}

function validateAndMergeIkuSubmissionsForUnit(existingList, incomingList, callerUser, ip) {
  const callerEmail = callerUser.email.toLowerCase();
  const baseArr = Array.isArray(existingList) ? existingList : [];
  const incArr = Array.isArray(incomingList) ? incomingList : [];
  const baseById = new Map(baseArr.map((r) => [r.id, r]));

  for (const rec of incArr) {
    if (!rec?.id) continue;
    const prev = baseById.get(rec.id);
    const ownerEmail = String(rec.ownerEmail || prev?.ownerEmail || '').toLowerCase();
    if (ownerEmail && ownerEmail !== callerEmail) {
      if (JSON.stringify(prev) !== JSON.stringify(rec)) {
        appendAuditLog('SECURITY_VIOLATION', `Percobaan modifikasi IKU milik ${ownerEmail} oleh ${callerEmail}`, callerEmail, ip);
        throw Object.assign(new Error('Akses ditolak: Tidak dapat mengubah submission IKU milik akun lain.'), { status: 403 });
      }
      continue;
    }
    if (['APPROVED', 'LOCKED'].includes(rec.status) && prev?.status !== rec.status) {
      appendAuditLog('SECURITY_VIOLATION', `Percobaan self-approve IKU (${rec.id}) oleh ${callerEmail}`, callerEmail, ip);
      throw Object.assign(new Error('Pelanggaran keamanan: Hanya Superadmin PRP yang berhak menyetujui IKU.'), { status: 403 });
    }
    baseById.set(rec.id, { ...rec, ownerEmail: callerEmail });
  }
  return [...baseById.values()];
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

    // 5. GET /api/v1/bootstrap
    if (pathname === '/api/v1/bootstrap' && req.method === 'GET') {
      const caller = resolveAuthenticatedUser(req, urlObj);
      const { stores, meta } = readAllKvStores();
      const users = listAllUsers();
      const broadcasts = listBroadcastsForUser(caller);
      const audit = listAuditLogs(200);
      sendJson(res, 200, {
        ok: true,
        authenticatedAs: caller ? { email: caller.email, role: caller.role, picCodes: caller.picCodes } : null,
        stores,
        meta,
        users,
        broadcasts,
        audit,
        serverTime: new Date().toISOString(),
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

      for (const [storeKey, incomingVal] of Object.entries(incomingStores)) {
        if (!ALLOWED_SYNC_KEYS.has(storeKey)) continue;

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
          if (storeKey === 'prp_users' && Array.isArray(incomingVal)) {
            syncUsersListFromAdmin(incomingVal, caller.email);
          }
          const result = writeKvStore(storeKey, incomingVal, caller.email);
          if (result.changed) {
            updatedKeys.push(storeKey);
            appendAuditLog('SYNC_CONFIG_PRP', `Pembaruan ${storeKey} (v${result.version})`, caller.email, ip);
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

      sendJson(res, 200, {
        ok: true,
        updatedKeys,
        stores,
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
