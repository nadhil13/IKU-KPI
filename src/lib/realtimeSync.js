/**
 * Mesin Sinkronisasi Realtime Terpadu & Siaran Instruksi Pusat (Broadcast)
 * Menghubungkan Frontend React dengan Backend SQLite WAL (/api/v1/*),
 * Server-Sent Events (SSE /api/v1/realtime/stream), BroadcastChannel lintas tab,
 * serta Notifikasi Sistem Layar Kunci (OS Push Notification).
 */
import {
  dispatchOsNotification,
  checkForAppUpdate,
} from './pwaNotifications.js';

const TOKEN_STORAGE_KEY = 'performa_access_token';
const BROADCAST_STORAGE_KEY = 'prp_broadcasts_v1';
const BROADCAST_EVENT = 'prp-broadcasts-updated';
const REALTIME_STATUS_EVENT = 'prp-realtime-status';
const CHANNEL_NAME = 'performa_realtime_bus_v1';

const SYNCED_STORE_KEYS = [
  'prp_kpi_distribution_v1',
  'prp_kpi_config',
  'prp_kpi_validation_rules',
  'prp_iku_submissions_v1',
  'prp_periods',
  'prp_system_config',
  'prp_organization',
  'prp_users',
  'prp_notifications_v1',
  'prp_email_outbox_v1',
  'prp_spi_audit_v1',
];

const clientId = `client_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
let isApplyingRemote = false;
let sseSource = null;
let broadcastChannel = null;
let pushDebounceTimer = null;
const pendingStoreKeys = new Set();
let realtimeStatus = {
  connected: false,
  mode: 'local-bus',
  lastSyncAt: null,
  serverAuditValid: true,
};

function notifyRealtimeStatus(patch) {
  realtimeStatus = { ...realtimeStatus, ...patch };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REALTIME_STATUS_EVENT, { detail: realtimeStatus }));
  }
}

export function getRealtimeStatus() {
  return realtimeStatus;
}

export function subscribeRealtimeStatus(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(realtimeStatus);
  window.addEventListener(REALTIME_STATUS_EVENT, handler);
  return () => window.removeEventListener(REALTIME_STATUS_EVENT, handler);
}

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

function getCurrentUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('performa_user') || 'null');
  } catch {
    return null;
  }
}

function dispatchStoreRefreshEvents(changedKeys = []) {
  if (typeof window === 'undefined') return;
  const set = new Set(changedKeys);
  if (set.has('prp_kpi_distribution_v1')) {
    window.dispatchEvent(new Event('prp-kpi-workflow-updated'));
  }
  if (set.has('prp_kpi_config') || set.has('prp_kpi_validation_rules')) {
    window.dispatchEvent(new Event('prp-kpi-config-updated'));
  }
  if (set.has('prp_iku_submissions_v1')) {
    window.dispatchEvent(new Event('prp-iku-updated'));
  }
  if (set.has('prp_notifications_v1') || set.has('prp_email_outbox_v1')) {
    window.dispatchEvent(new Event('prp-notifications-updated'));
  }
  if (set.has('prp_spi_audit_v1')) {
    window.dispatchEvent(new Event('prp-spi-audit-updated'));
    window.dispatchEvent(new Event('prp-kpi-workflow-updated'));
  }
  window.dispatchEvent(new Event('prp-admin-updated'));
}

function mergeRemoteUsersPreservingLocalSecrets(incomingUsers = []) {
  let existing = [];
  try {
    const raw = JSON.parse(localStorage.getItem('prp_users') || '[]');
    existing = Array.isArray(raw) ? raw : [];
  } catch {
    existing = [];
  }
  const existingByEmail = new Map(
    existing
      .filter((u) => typeof u?.email === 'string')
      .map((u) => [u.email.toLowerCase(), u])
  );
  return incomingUsers.map((user) => {
    const email = String(user?.email || '').toLowerCase();
    const prev = email ? existingByEmail.get(email) : null;
    if (!user.password && prev?.password) {
      return { ...user, password: prev.password };
    }
    return user;
  });
}

const RECENT_REMOTE_NOTIF_WINDOW_MS = 15 * 60 * 1000;

export function doesSyncNotificationMatchUser(notif, user) {
  if (!notif || !user || !user.email) return false;
  const email = String(user.email || '').toLowerCase();
  if (user.role === 'superadmin_prp' && notif.includeSuperadmin) return true;

  const targetType = String(notif.targetType || 'ALL').toUpperCase();
  const targetValue = String(notif.targetValue || '').trim();

  if (targetType === 'ALL') return true;
  if (targetType === 'ROLE') {
    if (targetValue === 'kpi_only') return user.role === 'kpi_only' || user.role === 'dual';
    if (targetValue === 'iku_only') return user.role === 'iku_only' || user.role === 'dual';
    return user.role === targetValue;
  }
  if (targetType === 'PIC') {
    const targetPics = new Set(
      targetValue
        .split(/[,;\s]+/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean),
    );
    const userPics = Array.isArray(user.picCodes)
      ? user.picCodes.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean)
      : [];
    return userPics.some((code) => targetPics.has(code));
  }
  if (targetType === 'USER') {
    const allowedEmails = targetValue
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowedEmails.includes(email);
  }
  return false;
}

export function notifyMatchingRemoteNotifications(incomingList = [], priorSerialized = null, userOverride = null) {
  if (!Array.isArray(incomingList) || incomingList.length === 0) return [];
  const user = userOverride || getCurrentUserFromStorage();
  if (!user?.email) return [];
  const email = String(user.email || '').toLowerCase();

  let prevIds = null;
  if (typeof priorSerialized === 'string' && priorSerialized.trim()) {
    try {
      const parsed = JSON.parse(priorSerialized);
      if (Array.isArray(parsed)) {
        prevIds = new Set(parsed.map((n) => n?.id).filter(Boolean));
      }
    } catch {
      prevIds = null;
    }
  }

  const dispatched = [];
  const nowMs = Date.now();
  for (const notif of incomingList) {
    if (!notif?.id || !notif?.title) continue;
    if (prevIds && prevIds.has(notif.id)) continue;
    const isAlreadyRead = Array.isArray(notif.readBy)
      && notif.readBy.some((r) => String(r || '').toLowerCase() === email);
    if (isAlreadyRead) continue;
    if (!doesSyncNotificationMatchUser(notif, user)) continue;

    // Pada sinkronisasi pertama tanpa riwayat lokal, hanya tampilkan notifikasi yang masih baru (< 15 menit)
    if (!prevIds && notif.createdAt) {
      const ageMs = nowMs - Date.parse(notif.createdAt);
      if (Number.isFinite(ageMs) && ageMs > RECENT_REMOTE_NOTIF_WINDOW_MS) continue;
    }

    const kindLabel = notif.kind ? `[${notif.kind}] ` : '';
    const priority = String(
      notif.priority || (notif.kind === 'REVISION' ? 'URGENT' : 'IMPORTANT'),
    ).toUpperCase();
    dispatched.push(notif.id);
    dispatchOsNotification({
      id: notif.id,
      title: `${kindLabel}${notif.title}`,
      body: notif.message || notif.title,
      priority,
      url: notif.actionUrl || '/internal',
      actionLabel: notif.actionLabel || 'Buka Portal Kinerja',
    });
  }
  return dispatched;
}

function mergeRemoteStoreWithLocal(key, remoteVal) {
  if (!remoteVal || typeof remoteVal !== 'object') return remoteVal;
  try {
    const rawLocal = localStorage.getItem(key);
    if (!rawLocal) return remoteVal;
    const localVal = JSON.parse(rawLocal);
    if (!localVal || typeof localVal !== 'object') return remoteVal;

    if (key === 'prp_spi_audit_v1') {
      const localRecords = localVal.records && typeof localVal.records === 'object' ? localVal.records : {};
      const remoteRecords = remoteVal.records && typeof remoteVal.records === 'object' ? remoteVal.records : {};
      const mergedRecords = { ...remoteRecords };
      for (const [fId, locRec] of Object.entries(localRecords)) {
        const remRec = remoteRecords[fId];
        const locTime = Date.parse(locRec?.updatedAt || '') || 0;
        const remTime = Date.parse(remRec?.updatedAt || '') || 0;
        if (!remRec || locTime >= remTime) {
          mergedRecords[fId] = locRec;
        }
      }
      return {
        ...remoteVal,
        records: mergedRecords,
        updatedAt: Date.parse(localVal.updatedAt || '') > Date.parse(remoteVal.updatedAt || '')
          ? localVal.updatedAt
          : (remoteVal.updatedAt || localVal.updatedAt || null),
      };
    }

    if (key === 'prp_kpi_distribution_v1') {
      if ((!Array.isArray(remoteVal.forms) || remoteVal.forms.length === 0) && Array.isArray(localVal.forms) && localVal.forms.length > 0) {
        return localVal;
      }
      const userEmail = String(getCurrentUserFromStorage()?.email || '').trim().toLowerCase();
      if (!userEmail) return remoteVal;

      const suffix = `:${userEmail}`;
      const nextDrafts = { ...(remoteVal.drafts || {}) };
      const nextSubmissions = { ...(remoteVal.submissions || {}) };
      const nextEvidence = { ...(remoteVal.evidence || {}) };

      for (const [k, locSub] of Object.entries(localVal.submissions || {})) {
        if (!k.toLowerCase().endsWith(suffix) || !locSub) continue;
        const remSub = nextSubmissions[k];
        const locTime = Date.parse(locSub.reviewedAt || locSub.updatedAt || locSub.submittedAt || '') || 0;
        const remTime = Date.parse(remSub?.reviewedAt || remSub?.updatedAt || remSub?.submittedAt || '') || 0;
        if (!remSub || locTime >= remTime) {
          nextSubmissions[k] = locSub;
        }
      }

      for (const [k, locDraft] of Object.entries(localVal.drafts || {})) {
        if (!k.toLowerCase().endsWith(suffix) || !locDraft) continue;
        const remDraft = nextDrafts[k];
        const remSub = nextSubmissions[k];
        const locTime = Date.parse(locDraft.updatedAt || '') || 0;
        const remDraftTime = Date.parse(remDraft?.updatedAt || '') || 0;
        const remSubTime = Date.parse(remSub?.reviewedAt || remSub?.updatedAt || remSub?.submittedAt || '') || 0;
        if ((!remDraft || locTime >= remDraftTime) && (!remSub || remSub.status === 'NEEDS_REVISION' || locTime > remSubTime)) {
          nextDrafts[k] = locDraft;
        }
      }

      for (const [k, locEvList] of Object.entries(localVal.evidence || {})) {
        if (!k.toLowerCase().endsWith(suffix) || !Array.isArray(locEvList) || locEvList.length === 0) continue;
        const remEvList = nextEvidence[k];
        if (!Array.isArray(remEvList) || remEvList.length < locEvList.length) {
          nextEvidence[k] = locEvList;
        }
      }

      return {
        ...remoteVal,
        drafts: nextDrafts,
        submissions: nextSubmissions,
        evidence: nextEvidence,
      };
    }
  } catch {
    return remoteVal;
  }
  return remoteVal;
}

function applyRemoteStoresToLocal(storesMap = {}, remoteUsers = null, remoteAudit = null) {
  if (typeof localStorage === 'undefined') return;
  isApplyingRemote = true;
  const changedKeys = [];
  const priorNotifRaw = localStorage.getItem('prp_notifications_v1');
  try {
    for (const [key, val] of Object.entries(storesMap || {})) {
      if (val === undefined || val === null) continue;
      let nextVal = key === 'prp_users' && Array.isArray(val)
        ? mergeRemoteUsersPreservingLocalSecrets(val)
        : val;
      if (key === 'prp_kpi_distribution_v1' || key === 'prp_spi_audit_v1') {
        nextVal = mergeRemoteStoreWithLocal(key, nextVal);
      }
      const serialized = JSON.stringify(nextVal);
      if (localStorage.getItem(key) !== serialized) {
        localStorage.setItem(key, serialized);
        changedKeys.push(key);
        if (key === 'prp_notifications_v1' && Array.isArray(nextVal)) {
          notifyMatchingRemoteNotifications(nextVal, priorNotifRaw);
        }
      }
    }
    if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
      const mergedRemote = mergeRemoteUsersPreservingLocalSecrets(remoteUsers);
      const serializedUsers = JSON.stringify(mergedRemote);
      if (localStorage.getItem('prp_users') !== serializedUsers) {
        localStorage.setItem('prp_users', serializedUsers);
        changedKeys.push('prp_users');
      }
    }
    if (Array.isArray(remoteAudit) && remoteAudit.length > 0) {
      const existingAudit = JSON.parse(localStorage.getItem('prp_audit') || '[]');
      const byId = new Map();
      [...remoteAudit, ...existingAudit].forEach((entry) => {
        if (entry?.id && !byId.has(entry.id)) byId.set(entry.id, entry);
      });
      const mergedAudit = [...byId.values()]
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
        .slice(0, 500);
      localStorage.setItem('prp_audit', JSON.stringify(mergedAudit));
    }
    if (changedKeys.length > 0) {
      dispatchStoreRefreshEvents(changedKeys);
    }
    notifyRealtimeStatus({ lastSyncAt: new Date().toISOString() });
  } finally {
    isApplyingRemote = false;
  }
}

export async function loginViaBackend(email, password) {
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { handledByBackend: false };
    }
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        handledByBackend: true,
        success: false,
        status: res.status,
        message: data.error || 'Autentikasi gagal.',
      };
    }
    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return {
      handledByBackend: true,
      success: true,
      user: data.user,
      accessToken: data.accessToken,
    };
  } catch {
    return { handledByBackend: false };
  }
}

export async function logoutViaBackend() {
  const token = getAccessToken();
  setAccessToken('');
  if (sseSource) {
    try {
      sseSource.close();
    } catch {
      // Abaikan
    }
    sseSource = null;
  }
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Abaikan jika sedang offline
  }
}

export async function updateOwnProfileViaBackend(changes) {
  const token = getAccessToken();
  if (!token) return { handled: false };
  try {
    const res = await fetch('/api/v1/auth/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(changes || {}),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return { handled: false };
    const data = await res.json();
    return { handled: true, ok: res.ok && data.ok, user: data.user, error: data.error };
  } catch {
    return { handled: false };
  }
}

export async function changeOwnPasswordViaBackend(currentPassword, newPassword) {
  const token = getAccessToken();
  if (!token) return { handled: false };
  try {
    const res = await fetch('/api/v1/auth/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return { handled: false };
    const data = await res.json();
    return { handled: true, ok: res.ok && data.ok, user: data.user, error: data.error };
  } catch {
    return { handled: false };
  }
}

export async function deleteUserViaBackend(email) {
  const token = getAccessToken();
  if (!token || !email) return { handled: false };
  try {
    const res = await fetch(`/api/v1/users/${encodeURIComponent(String(email).toLowerCase())}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return { handled: false };
    const data = await res.json();
    return { handled: true, ok: res.ok && data.ok, error: data.error };
  } catch {
    return { handled: false };
  }
}

export async function bootstrapFromBackend() {
  try {
    const token = getAccessToken();
    const res = await fetch('/api/v1/bootstrap', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return false;
    const data = await res.json();
    if (!data.ok) return false;

    // Jika server masih kosong (mis. cold-start serverless) tetapi browser sudah punya state lokal, dorong state awal ke server
    const serverHasForms = Boolean(data.stores?.prp_kpi_distribution_v1?.forms?.length);
    const currentUser = getCurrentUserFromStorage();
    const hasLocalStores = SYNCED_STORE_KEYS.some((k) => Boolean(localStorage.getItem(k)));
    if (!serverHasForms && hasLocalStores && token && currentUser?.role !== 'spi') {
      queueStorePush(SYNCED_STORE_KEYS);
    } else if (data.stores && Object.keys(data.stores).length > 0) {
      applyRemoteStoresToLocal(data.stores, data.users, data.audit);
    }

    if (Array.isArray(data.broadcasts)) {
      const prevIds = new Set(readLocalBroadcastsCache().map((b) => b?.id).filter(Boolean));
      saveLocalBroadcastsCache(data.broadcasts, false);
      const user = getCurrentUserFromStorage();
      const newestUnseen = data.broadcasts.find(
        (b) => b?.id && !prevIds.has(b.id) && user && doesBroadcastTargetUserClient(b, user),
      );
      if (newestUnseen) {
        window.dispatchEvent(new CustomEvent('prp-broadcast-incoming-toast', { detail: newestUnseen }));
        dispatchOsNotification({
          id: newestUnseen.id,
          title: `Siaran PRP: ${newestUnseen.title}`,
          body: newestUnseen.message,
          priority: newestUnseen.priority || 'IMPORTANT',
          url: newestUnseen.actionUrl || '/internal',
          actionLabel: newestUnseen.actionLabel || 'Buka Lembar Kerja',
        });
      }
    }
    notifyRealtimeStatus({
      connected: true,
      mode: realtimeStatus.mode === 'server-sse' ? 'server-sse' : 'server-digest',
      lastSyncAt: data.serverTime || new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export function queueStorePush(keys = []) {
  if (isApplyingRemote || typeof window === 'undefined') return;
  keys.forEach((k) => pendingStoreKeys.add(k));

  // Siarkan instan ke tab lain pada browser yang sama melalui BroadcastChannel
  if (broadcastChannel && keys.length > 0) {
    const payload = {};
    keys.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) payload[k] = JSON.parse(raw);
      } catch {
        // Abaikan
      }
    });
    try {
      broadcastChannel.postMessage({
        type: 'state:updated',
        originClientId: clientId,
        stores: payload,
        at: new Date().toISOString(),
      });
    } catch {
      // Abaikan
    }
  }

  clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    flushPendingStorePush();
  }, 140);
}

async function flushPendingStorePush() {
  if (pendingStoreKeys.size === 0) return;
  const user = getCurrentUserFromStorage();
  const token = getAccessToken();
  if (!user || !token) {
    pendingStoreKeys.clear();
    return;
  }

  const keysToPush = [...pendingStoreKeys];
  pendingStoreKeys.clear();

  const storesPayload = {};
  for (const key of keysToPush) {
    if (user.role === 'spi' && key !== 'prp_spi_audit_v1' && key !== 'prp_kpi_distribution_v1') continue;
    if (key === 'prp_spi_audit_v1' && user.role !== 'spi') continue;
    if (SUPERADMIN_ONLY_SET.has(key) && user.role !== 'superadmin_prp') continue;
    if (key === 'prp_iku_submissions_v1' && user.role === 'kpi_only') continue;
    if (key === 'prp_kpi_distribution_v1' && user.role === 'iku_only') continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (user.role === 'spi' && key === 'prp_kpi_distribution_v1' && parsed && typeof parsed === 'object') {
          const ownSuffix = `:${String(user.email || 'spi@itpln.ac.id').toLowerCase()}`;
          const filterOwn = (mapObj) => Object.fromEntries(
            Object.entries(mapObj || {}).filter(([k]) => k.toLowerCase().endsWith(ownSuffix)),
          );
          const ownDrafts = filterOwn(parsed.drafts);
          const ownSubs = filterOwn(parsed.submissions);
          const ownEv = filterOwn(parsed.evidence);
          if (Object.keys(ownDrafts).length === 0 && Object.keys(ownSubs).length === 0 && Object.keys(ownEv).length === 0) {
            continue;
          }
          storesPayload[key] = {
            ...parsed,
            drafts: ownDrafts,
            submissions: ownSubs,
            evidence: ownEv,
          };
        } else {
          storesPayload[key] = parsed;
        }
      }
    } catch {
      // Abaikan JSON tidak valid
    }
  }

  if (Object.keys(storesPayload).length === 0) return;

  try {
    const res = await fetch('/api/v1/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Client-Id': clientId,
      },
      body: JSON.stringify({ clientId, stores: storesPayload }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.ok && data.stores) {
        applyRemoteStoresToLocal(data.stores, null, data.audit);
      }
    }
  } catch {
    // Tetap berfungsi secara offline/lokal jika endpoint belum terjangkau
  }
}

const SUPERADMIN_ONLY_SET = new Set([
  'prp_kpi_config',
  'prp_kpi_validation_rules',
  'prp_periods',
  'prp_system_config',
  'prp_organization',
  'prp_users',
]);

// API siaran instruksi pusat (Broadcast) dan cadangan penyimpanan lokal.

export function readLocalBroadcastsCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROADCAST_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalBroadcastsCache(list, broadcastOverChannel = true) {
  try {
    localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Abaikan batas kuota
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROADCAST_EVENT, { detail: list }));
  }
  if (broadcastOverChannel && broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'broadcast:sync',
        originClientId: clientId,
        broadcasts: list,
        at: new Date().toISOString(),
      });
    } catch {
      // Abaikan
    }
  }
}

export function doesBroadcastTargetUserClient(broadcast, user) {
  if (!broadcast || broadcast.active === false) return false;
  if (broadcast.expiresAt && new Date(broadcast.expiresAt).getTime() < Date.now()) return false;
  if (!user) return false;
  if (user.role === 'superadmin_prp') return true;
  if (broadcast.targetType === 'ALL') return true;
  if (broadcast.targetType === 'ROLE') {
    return String(user.role || '').toLowerCase() === String(broadcast.targetValue || '').toLowerCase();
  }
  if (broadcast.targetType === 'USER') {
    const targets = String(broadcast.targetValue || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return targets.includes(String(user.email || '').toLowerCase());
  }
  if (broadcast.targetType === 'PIC') {
    const targetPics = String(broadcast.targetValue || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const userPics = (user.picCodes || []).map((c) => String(c).trim().toUpperCase());
    return targetPics.some((code) => userPics.includes(code));
  }
  return false;
}

export function getActiveBroadcastsForUser(user) {
  const all = readLocalBroadcastsCache();
  return all.filter((b) => doesBroadcastTargetUserClient(b, user));
}

export async function sendRealtimeBroadcast(payload, senderUser) {
  if (!senderUser || senderUser.role !== 'superadmin_prp') {
    throw new Error('Hanya Superadmin PRP yang berwenang mengirim siaran instruksi.');
  }
  const token = getAccessToken();
  const cleanPayload = {
    title: String(payload.title || '').trim(),
    message: String(payload.message || '').trim(),
    priority: ['INFO', 'IMPORTANT', 'URGENT'].includes(payload.priority) ? payload.priority : 'IMPORTANT',
    targetType: ['ALL', 'ROLE', 'PIC', 'USER'].includes(payload.targetType) ? payload.targetType : 'ALL',
    targetValue: payload.targetType === 'ALL' ? '' : String(payload.targetValue || '').trim(),
    actionUrl: String(payload.actionUrl || '/internal').trim(),
    actionLabel: String(payload.actionLabel || 'Buka Lembar Kerja').trim(),
  };

  if (!cleanPayload.title || !cleanPayload.message) {
    throw new Error('Judul dan isi pesan instruksi wajib diisi.');
  }

  try {
    const res = await fetch('/api/v1/broadcasts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cleanPayload),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.ok && data.broadcast) {
        const existing = readLocalBroadcastsCache().filter((b) => b.id !== data.broadcast.id);
        saveLocalBroadcastsCache([data.broadcast, ...existing], true);
        dispatchOsNotification({
          id: data.broadcast.id,
          title: `Siaran PRP: ${data.broadcast.title}`,
          body: data.broadcast.message,
          priority: data.broadcast.priority || 'IMPORTANT',
          url: data.broadcast.actionUrl || '/internal',
          actionLabel: data.broadcast.actionLabel || 'Buka Lembar Kerja',
        });
        return data.broadcast;
      }
    }
  } catch {
    // Fallback lokal apabila server sedang tidak aktif
  }

  const fallbackBroadcast = {
    id: `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ...cleanPayload,
    senderEmail: senderUser.email,
    senderName: senderUser.name || 'Superadmin PRP',
    active: true,
    createdAt: new Date().toISOString(),
    expiresAt: null,
    acknowledgements: [],
  };
  const existing = readLocalBroadcastsCache();
  saveLocalBroadcastsCache([fallbackBroadcast, ...existing], true);
  dispatchOsNotification({
    id: fallbackBroadcast.id,
    title: `Siaran PRP: ${fallbackBroadcast.title}`,
    body: fallbackBroadcast.message,
    priority: fallbackBroadcast.priority || 'IMPORTANT',
    url: fallbackBroadcast.actionUrl || '/internal',
    actionLabel: fallbackBroadcast.actionLabel || 'Buka Lembar Kerja',
  });
  return fallbackBroadcast;
}

export async function acknowledgeRealtimeBroadcast(broadcastId, user) {
  if (!broadcastId || !user?.email) return null;
  const token = getAccessToken();
  try {
    const res = await fetch(`/api/v1/broadcasts/${encodeURIComponent(broadcastId)}/ack`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.ok && data.broadcast) {
        const updatedList = readLocalBroadcastsCache().map((b) => (b.id === broadcastId ? data.broadcast : b));
        saveLocalBroadcastsCache(updatedList, true);
        return data.broadcast;
      }
    }
  } catch {
    // Fallback lokal
  }

  const list = readLocalBroadcastsCache().map((b) => {
    if (b.id !== broadcastId) return b;
    const acks = Array.isArray(b.acknowledgements) ? [...b.acknowledgements] : [];
    if (!acks.some((a) => a.email?.toLowerCase() === user.email.toLowerCase())) {
      acks.unshift({
        email: user.email.toLowerCase(),
        name: user.name || user.email,
        unit: user.unit || '',
        ackedAt: new Date().toISOString(),
      });
    }
    return { ...b, acknowledgements: acks };
  });
  saveLocalBroadcastsCache(list, true);
  return list.find((b) => b.id === broadcastId) || null;
}

export async function stopRealtimeBroadcast(broadcastId, user) {
  if (!user || user.role !== 'superadmin_prp') {
    throw new Error('Hanya Superadmin PRP yang dapat menghentikan siaran.');
  }
  const token = getAccessToken();
  try {
    await fetch(`/api/v1/broadcasts/${encodeURIComponent(broadcastId)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Fallback lokal
  }
  const remaining = readLocalBroadcastsCache().filter((b) => b.id !== broadcastId);
  saveLocalBroadcastsCache(remaining, true);
  return true;
}

export function subscribeBroadcasts(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(readLocalBroadcastsCache());
  const storageHandler = (e) => {
    if (!e.key || e.key === BROADCAST_STORAGE_KEY) handler();
  };
  window.addEventListener(BROADCAST_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(BROADCAST_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

let listenersMounted = false;

export function connectRealtimeEngine() {
  if (typeof window === 'undefined') return () => {};

  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || msg.originClientId === clientId) return;
        if (msg.type === 'state:updated' && msg.stores) {
          applyRemoteStoresToLocal(msg.stores);
          const user = getCurrentUserFromStorage();
          if (user && (msg.stores.prp_kpi_config || msg.stores.prp_kpi_distribution_v1)) {
            dispatchOsNotification({
              id: `kpi-sync-${msg.at || Date.now()}`,
              title: 'Pembaruan Tabel KPI Realtime',
              body: 'Struktur baris atau status evaluasi KPI telah diperbarui secara realtime.',
              priority: 'IMPORTANT',
              url: '/internal',
            });
          }
        } else if (msg.type === 'broadcast:sync' && Array.isArray(msg.broadcasts)) {
          saveLocalBroadcastsCache(msg.broadcasts, false);
          const user = getCurrentUserFromStorage();
          const newest = msg.broadcasts[0];
          if (user && newest && doesBroadcastTargetUserClient(newest, user)) {
            dispatchOsNotification({
              id: newest.id,
              title: `Siaran PRP: ${newest.title}`,
              body: newest.message,
              priority: newest.priority || 'IMPORTANT',
              url: newest.actionUrl || '/internal',
              actionLabel: newest.actionLabel || 'Buka Lembar Kerja',
            });
          }
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }

  if (!listenersMounted) {
    listenersMounted = true;
    window.addEventListener('prp-kpi-workflow-updated', () => {
      if (!isApplyingRemote) queueStorePush(['prp_kpi_distribution_v1']);
    });
    window.addEventListener('prp-kpi-config-updated', () => {
      if (!isApplyingRemote) queueStorePush(['prp_kpi_config', 'prp_kpi_validation_rules']);
    });
    window.addEventListener('prp-iku-updated', () => {
      if (!isApplyingRemote) queueStorePush(['prp_iku_submissions_v1']);
    });
    window.addEventListener('prp-notifications-updated', () => {
      if (!isApplyingRemote) queueStorePush(['prp_notifications_v1', 'prp_email_outbox_v1']);
    });
    window.addEventListener('prp-spi-audit-updated', () => {
      if (!isApplyingRemote) queueStorePush(['prp_spi_audit_v1']);
    });
    window.addEventListener('prp-admin-updated', () => {
      if (!isApplyingRemote) {
        queueStorePush(['prp_periods', 'prp_system_config', 'prp_organization', 'prp_users']);
      }
    });
  }

  let disposed = false;
  let lastDigestHash = '';
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let digestInFlight = false;
  let lastVersionCheckAt = 0;

  const closeSse = () => {
    if (sseSource) {
      try {
        sseSource.close();
      } catch {
        // Abaikan
      }
      sseSource = null;
    }
  };

  const syncFromDigest = async ({ forceVersionCheck = false } = {}) => {
    if (disposed) return;
    if (forceVersionCheck || Date.now() - lastVersionCheckAt >= 45000) {
      lastVersionCheckAt = Date.now();
      checkForAppUpdate().catch(() => undefined);
    }
    const token = getAccessToken();
    if (!token || digestInFlight) return;
    digestInFlight = true;
    try {
      const res = await fetch('/api/v1/realtime/digest', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (!data?.ok) return;

      if (data.digestHash && data.digestHash !== lastDigestHash) {
        lastDigestHash = data.digestHash;
        await bootstrapFromBackend();
      } else {
        notifyRealtimeStatus({
          connected: true,
          mode: sseSource && sseSource.readyState === 1 ? 'server-sse' : 'server-digest',
          lastSyncAt: data.serverTime || new Date().toISOString(),
        });
      }
    } catch {
      // Abaikan saat luring
    } finally {
      digestInFlight = false;
    }
  };

  const openSseStream = () => {
    if (disposed || typeof EventSource === 'undefined') return;
    closeSse();

    const token = getAccessToken();
    const url = token
      ? `/api/v1/realtime/stream?token=${encodeURIComponent(token)}`
      : '/api/v1/realtime/stream';
    const es = new EventSource(url);
    sseSource = es;

    es.addEventListener('connected', () => {
      reconnectAttempts = 0;
      notifyRealtimeStatus({ connected: true, mode: 'server-sse', lastSyncAt: new Date().toISOString() });
    });

    es.addEventListener('state:updated', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.originClientId === clientId) return;
        applyRemoteStoresToLocal(data.stores, data.users, data.audit);
        const user = getCurrentUserFromStorage();
        const keys = Array.isArray(data.updatedKeys) ? data.updatedKeys : Object.keys(data.stores || {});
        if (user && (keys.includes('prp_kpi_config') || keys.includes('prp_kpi_distribution_v1'))) {
          dispatchOsNotification({
            id: `sse-kpi-${data.at || Date.now()}`,
            title: 'Sinkronisasi KPI Realtime (PRP)',
            body: `Perubahan baris atau evaluasi KPI oleh ${data.actor?.name || 'Admin PRP'} telah masuk ke lembar kerja Anda.`,
            priority: 'IMPORTANT',
            url: '/internal',
          });
        }
      } catch {
        // Abaikan paket tidak valid
      }
    });

    es.addEventListener('broadcast:published', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.broadcast) return;
        const current = readLocalBroadcastsCache().filter((b) => b.id !== data.broadcast.id);
        saveLocalBroadcastsCache([data.broadcast, ...current], false);
        window.dispatchEvent(new CustomEvent('prp-broadcast-incoming-toast', { detail: data.broadcast }));
        const user = getCurrentUserFromStorage();
        if (user && doesBroadcastTargetUserClient(data.broadcast, user)) {
          dispatchOsNotification({
            id: data.broadcast.id,
            title: `Siaran PRP: ${data.broadcast.title}`,
            body: data.broadcast.message,
            priority: data.broadcast.priority || 'IMPORTANT',
            url: data.broadcast.actionUrl || '/internal',
            actionLabel: data.broadcast.actionLabel || 'Buka Lembar Kerja',
          });
        }
      } catch {
        // Abaikan
      }
    });

    es.addEventListener('broadcast:acknowledged', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.broadcast) return;
        const updated = readLocalBroadcastsCache().map((b) => (b.id === data.broadcast.id ? data.broadcast : b));
        saveLocalBroadcastsCache(updated, false);
      } catch {
        // Abaikan
      }
    });

    es.addEventListener('broadcast:deleted', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.broadcastId) return;
        const filtered = readLocalBroadcastsCache().filter((b) => b.id !== data.broadcastId);
        saveLocalBroadcastsCache(filtered, false);
      } catch {
        // Abaikan
      }
    });

    es.onerror = () => {
      closeSse();
      notifyRealtimeStatus({ connected: true, mode: 'server-digest' });
      if (disposed || reconnectTimer) return;
      const delayMs = Math.min(15000, 2000 * (2 ** Math.min(reconnectAttempts, 3)));
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!disposed && navigator.onLine !== false) {
          openSseStream();
        }
      }, delayMs);
    };
  };

  const handleResume = () => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    syncFromDigest({ forceVersionCheck: true });
    if (!sseSource || sseSource.readyState === 2) {
      openSseStream();
    }
  };

  window.addEventListener('visibilitychange', handleResume);
  window.addEventListener('focus', handleResume);
  window.addEventListener('pageshow', handleResume);
  window.addEventListener('online', handleResume);

  const digestTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    syncFromDigest();
  }, 4000);

  bootstrapFromBackend().then((backendActive) => {
    if (disposed) return;
    checkForAppUpdate().catch(() => undefined);
    if (!backendActive || typeof EventSource === 'undefined') {
      notifyRealtimeStatus({ connected: true, mode: 'local-bus' });
      return;
    }
    syncFromDigest();
    openSseStream();
  });

  return () => {
    disposed = true;
    clearInterval(digestTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    window.removeEventListener('visibilitychange', handleResume);
    window.removeEventListener('focus', handleResume);
    window.removeEventListener('pageshow', handleResume);
    window.removeEventListener('online', handleResume);
    closeSse();
  };
}
