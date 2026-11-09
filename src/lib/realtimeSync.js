/**
 * Mesin Sinkronisasi Realtime Terpadu & Siaran Instruksi Pusat (Broadcast)
 * Menghubungkan Frontend React dengan Backend SQLite WAL (/api/v1/*),
 * Server-Sent Events (SSE /api/v1/realtime/stream), serta BroadcastChannel lintas tab.
 */

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
  window.dispatchEvent(new Event('prp-admin-updated'));
}

function applyRemoteStoresToLocal(storesMap = {}, remoteUsers = null, remoteAudit = null) {
  if (typeof localStorage === 'undefined') return;
  isApplyingRemote = true;
  const changedKeys = [];
  try {
    for (const [key, val] of Object.entries(storesMap || {})) {
      if (val === undefined || val === null) continue;
      const serialized = JSON.stringify(val);
      if (localStorage.getItem(key) !== serialized) {
        localStorage.setItem(key, serialized);
        changedKeys.push(key);
      }
    }
    if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
      const serializedUsers = JSON.stringify(remoteUsers);
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

    // Jika server masih kosong tetapi browser sudah punya state lokal, dorong state awal ke server
    const serverHasForms = Boolean(data.stores?.prp_kpi_distribution_v1?.forms?.length);
    const localRaw = localStorage.getItem('prp_kpi_distribution_v1');
    if (!serverHasForms && localRaw && token) {
      queueStorePush(SYNCED_STORE_KEYS);
    } else if (data.stores && Object.keys(data.stores).length > 0) {
      applyRemoteStoresToLocal(data.stores, data.users, data.audit);
    }

    if (Array.isArray(data.broadcasts)) {
      saveLocalBroadcastsCache(data.broadcasts, false);
    }
    notifyRealtimeStatus({
      connected: true,
      mode: 'server-sse',
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
    if (SUPERADMIN_ONLY_SET.has(key) && user.role !== 'superadmin_prp') continue;
    if (key === 'prp_iku_submissions_v1' && user.role === 'kpi_only') continue;
    if (key === 'prp_kpi_distribution_v1' && user.role === 'iku_only') continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        storesPayload[key] = JSON.parse(raw);
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

// ================== BROADCAST REALTIME API & FALLBACK ==================

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
        } else if (msg.type === 'broadcast:sync' && Array.isArray(msg.broadcasts)) {
          saveLocalBroadcastsCache(msg.broadcasts, false);
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
    window.addEventListener('prp-admin-updated', () => {
      if (!isApplyingRemote) {
        queueStorePush(['prp_periods', 'prp_system_config', 'prp_organization', 'prp_users']);
      }
    });
  }

  // Sambungkan SSE ke backend apabila EventSource tersedia
  if (sseSource) {
    try {
      sseSource.close();
    } catch {
      // Abaikan
    }
    sseSource = null;
  }

  bootstrapFromBackend().then((backendActive) => {
    if (!backendActive || typeof EventSource === 'undefined') {
      notifyRealtimeStatus({ connected: true, mode: 'local-bus' });
      return;
    }
    const token = getAccessToken();
    const url = token
      ? `/api/v1/realtime/stream?token=${encodeURIComponent(token)}`
      : '/api/v1/realtime/stream';
    const es = new EventSource(url);
    sseSource = es;

    es.addEventListener('connected', () => {
      notifyRealtimeStatus({ connected: true, mode: 'server-sse', lastSyncAt: new Date().toISOString() });
    });

    es.addEventListener('state:updated', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.originClientId === clientId) return;
        applyRemoteStoresToLocal(data.stores, data.users, data.audit);
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
      notifyRealtimeStatus({ connected: true, mode: 'local-bus' });
    };
  });

  return () => {
    if (sseSource) {
      try {
        sseSource.close();
      } catch {
        // Abaikan
      }
      sseSource = null;
    }
  };
}
