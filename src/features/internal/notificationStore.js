/**
 * Penyimpanan Notifikasi In-App Realtime & Rekam Jejak Email (Email Audit Trail) PERFORMA ITPLN.
 * Menangani pemberitahuan revisi per item/bagian, siaran admin (broadcast), sinkronisasi struktur tabel,
 * serta perubahan status periode lengkap dengan tautan tujuan (deep-link) dan log pengiriman email.
 */
import { readMergedUsers } from '../auth/authAccounts';
import { getUserPicCodes, normalizePicCodes } from '../kpi/kpiSchema';
import { dispatchOsNotification } from '../../lib/pwaNotifications';

export const NOTIFICATIONS_STORAGE_KEY = 'prp_notifications_v1';
export const EMAIL_OUTBOX_STORAGE_KEY = 'prp_email_outbox_v1';
export const NOTIFICATIONS_EVENT = 'prp-notifications-updated';

const readJSON = (key, fallback) => {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Abaikan kuota penyimpanan penuh
  }
};

export function readAllNotifications() {
  const list = readJSON(NOTIFICATIONS_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function readEmailOutboxLogs() {
  const list = readJSON(EMAIL_OUTBOX_STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

export const readEmailOutbox = readEmailOutboxLogs;

export function doesNotificationMatchUser(notif, user) {
  if (!notif || !user || !user.email) return false;
  const email = user.email.toLowerCase();
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
    const targetPics = new Set(normalizePicCodes(targetValue).map((c) => c.toLowerCase()));
    const userPics = getUserPicCodes(user).map((c) => c.toLowerCase());
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

export function resolveRecipientEmails(targetType = 'ALL', targetValue = '') {
  const users = readMergedUsers().filter((u) => u.status !== 'Nonaktif');
  const matched = users.filter((u) => doesNotificationMatchUser({ targetType, targetValue }, u));
  return [...new Set(matched.map((u) => u.email.toLowerCase()))];
}

export function recordEmailAuditDispatch({
  kind = 'REVISION',
  toEmails = [],
  recipientLabel = '',
  subject = '',
  body = '',
  actionUrl = '/internal',
  actorEmail = 'admin@itpln.ac.id',
  indicatorCode = '',
  period = '',
} = {}) {
  const cleanEmails = [...new Set((Array.isArray(toEmails) ? toEmails : [toEmails]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  const now = new Date().toISOString();
  const entry = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    messageId: `<${kind.toLowerCase()}-${Date.now()}@performa.itpln.ac.id>`,
    kind,
    toEmails: cleanEmails,
    recipientLabel: recipientLabel || cleanEmails.join(', ') || 'Unit Terkait',
    subject: subject || '[PERFORMA ITPLN] Pemberitahuan Sistem Kinerja',
    body: body || '',
    actionUrl: actionUrl || '/internal',
    actorEmail: actorEmail || 'admin@itpln.ac.id',
    indicatorCode: indicatorCode || '',
    period: period || '',
    sentAt: now,
    status: 'TERCATAT_AUDIT_EMAIL',
    gatewayNote: 'Tercatat pada rekam jejak audit email & siap diteruskan melalui relay resmi IT/BBTI ITPLN.',
  };

  const prev = readEmailOutboxLogs();
  const next = [entry, ...prev].slice(0, 300);
  writeJSON(EMAIL_OUTBOX_STORAGE_KEY, next);

  // Kirim juga ke endpoint backend apabila tersedia
  if (typeof fetch === 'function') {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('performa_access_token_v1') : '';
    fetch('/api/v1/notifications/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
    window.dispatchEvent(new Event('prp-admin-updated'));
  }
  return entry;
}

export function pushRealtimeNotification({
  kind = 'INFO',
  title = '',
  message = '',
  targetType = 'ALL',
  targetValue = '',
  actionUrl = '/internal',
  actionLabel = 'Buka Halaman Terkait',
  actorEmail = 'Superadmin PRP',
  actorName = 'Direktorat PRP',
  indicatorCode = '',
  period = '',
  sendEmail = false,
  includeSuperadmin = false,
} = {}) {
  if (!title.trim()) return null;
  const now = new Date().toISOString();
  const toEmails = resolveRecipientEmails(targetType, targetValue);

  let emailAudit = null;
  if (sendEmail) {
    emailAudit = recordEmailAuditDispatch({
      kind,
      toEmails,
      recipientLabel: `${targetType}: ${targetValue || 'Semua Unit'}`,
      subject: `[PERFORMA ITPLN - ${kind}] ${title.trim()}`,
      body: `${message.trim()}\n\nTautan Tindak Lanjut: ${actionUrl}\nWaktu: ${new Date(now).toLocaleString('id-ID')}\nPengirim: ${actorName} (${actorEmail})`,
      actionUrl,
      actorEmail,
      indicatorCode,
      period,
    });
  }

  const notif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: title.trim(),
    message: message.trim(),
    targetType: String(targetType || 'ALL').toUpperCase(),
    targetValue: String(targetValue || '').trim(),
    actionUrl: actionUrl || '/internal',
    actionLabel: actionLabel || 'Buka Halaman Terkait',
    actorEmail,
    actorName,
    indicatorCode,
    period,
    includeSuperadmin: Boolean(includeSuperadmin),
    emailAuditId: emailAudit?.id || null,
    emailRecipients: toEmails,
    readBy: [],
    createdAt: now,
  };

  const existing = readAllNotifications();
  const next = [notif, ...existing].slice(0, 250);
  writeJSON(NOTIFICATIONS_STORAGE_KEY, next);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT, { detail: notif }));
    window.dispatchEvent(new Event('prp-admin-updated'));
    try {
      const activeUser = JSON.parse(localStorage.getItem('performa_user') || 'null');
      if (activeUser && doesNotificationMatchUser(notif, activeUser)) {
        dispatchOsNotification({
          title: `[${notif.kind}] ${notif.title}`,
          body: notif.message,
          tag: notif.id,
          url: notif.actionUrl,
          priority: notif.kind === 'REVISION' ? 'URGENT' : 'IMPORTANT',
        });
      }
    } catch {
      // Abaikan jika di luar konteks browser
    }
  }

  return notif;
}

export function getNotificationsForUser(user) {
  if (!user?.email) return [];
  const email = user.email.toLowerCase();
  const all = readAllNotifications();
  return all
    .filter((n) => doesNotificationMatchUser(n, user) || (user.role === 'superadmin_prp' && n.actorEmail?.toLowerCase() === email))
    .map((n) => ({
      ...n,
      isRead: Array.isArray(n.readBy) && n.readBy.some((r) => String(r).toLowerCase() === email),
    }));
}

export function markNotificationRead(notifId, userEmail) {
  if (!notifId || !userEmail) return;
  const email = userEmail.toLowerCase();
  const all = readAllNotifications();
  let changed = false;
  const next = all.map((n) => {
    if (n.id !== notifId) return n;
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    if (readBy.some((r) => String(r).toLowerCase() === email)) return n;
    changed = true;
    return { ...n, readBy: [...readBy, email] };
  });
  if (changed) {
    writeJSON(NOTIFICATIONS_STORAGE_KEY, next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
    }
  }
}

export function markAllNotificationsRead(user) {
  if (!user?.email) return;
  const email = user.email.toLowerCase();
  const all = readAllNotifications();
  let changed = false;
  const next = all.map((n) => {
    if (!doesNotificationMatchUser(n, user)) return n;
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    if (readBy.some((r) => String(r).toLowerCase() === email)) return n;
    changed = true;
    return { ...n, readBy: [...readBy, email] };
  });
  if (changed) {
    writeJSON(NOTIFICATIONS_STORAGE_KEY, next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
    }
  }
}

export function subscribeNotifications(callback) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event) => {
    if (!event.key || event.key === NOTIFICATIONS_STORAGE_KEY || event.key === EMAIL_OUTBOX_STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener(NOTIFICATIONS_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(NOTIFICATIONS_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function buildMailtoHref({ toEmails = [], subject = '', body = '' } = {}) {
  const recipients = (Array.isArray(toEmails) ? toEmails : [toEmails]).filter(Boolean).join(',');
  return `mailto:${encodeURIComponent(recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
