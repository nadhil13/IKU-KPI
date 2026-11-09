/**
 * Manajer PWA (Android / iPhone / Desktop) & Notifikasi Sistem Layar Kunci (OS Push Notification).
 * Memungkinkan instalasi aplikasi ke layar utama HP dan pengiriman notifikasi bergaya media sosial
 * ke bilah status / layar kunci perangkat selama pengguna masih dalam sesi login aktif.
 */

const PWA_STATE_EVENT = 'performa-pwa-state-updated';
const NOTIF_PREF_KEY = 'performa_os_notif_enabled';
const SEEN_NOTIF_IDS_KEY = 'performa_seen_notif_ids_v1';

let deferredInstallPrompt = null;
let swRegistration = null;
let initialized = false;

function emitPwaState() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PWA_STATE_EVENT, { detail: getPwaAndNotificationState() }));
}

export function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.navigator?.standalone === true,
  );
}

export function detectMobilePlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = String(navigator.userAgent || '').toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function isOsNotificationEnabledByUser() {
  try {
    return localStorage.getItem(NOTIF_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setOsNotificationEnabledByUser(enabled) {
  try {
    localStorage.setItem(NOTIF_PREF_KEY, String(Boolean(enabled)));
  } catch {
    // Abaikan
  }
  emitPwaState();
}

export function getNotificationPermissionState() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export function getPwaAndNotificationState() {
  return {
    standalone: isRunningStandalone(),
    platform: detectMobilePlatform(),
    canPromptInstall: Boolean(deferredInstallPrompt),
    swReady: Boolean(swRegistration),
    notificationPermission: getNotificationPermissionState(),
    osNotifEnabled: isOsNotificationEnabledByUser(),
  };
}

export function subscribePwaState(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(getPwaAndNotificationState());
  window.addEventListener(PWA_STATE_EVENT, handler);
  return () => window.removeEventListener(PWA_STATE_EVENT, handler);
}

export async function initPwaAndNotifications(onNavigateFromNotification) {
  if (typeof window === 'undefined') return null;

  if (!initialized) {
    initialized = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      emitPwaState();
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      emitPwaState();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK_NAVIGATE' && event.data?.url) {
          onNavigateFromNotification?.(event.data.url);
        }
      });
    }
  }

  if ('serviceWorker' in navigator && !swRegistration) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = reg;
      emitPwaState();
    } catch {
      // Service worker dapat gagal pada lingkungan file://
    }
  }

  return swRegistration;
}

export async function triggerPwaInstallPrompt() {
  if (!deferredInstallPrompt) {
    return { outcome: 'manual-instructions', platform: detectMobilePlatform() };
  }
  try {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      deferredInstallPrompt = null;
    }
    emitPwaState();
    return { outcome: choice?.outcome || 'dismissed', platform: detectMobilePlatform() };
  } catch {
    return { outcome: 'manual-instructions', platform: detectMobilePlatform() };
  }
}

export async function requestOsNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      setOsNotificationEnabledByUser(true);
    }
    emitPwaState();
    return result;
  } catch {
    return Notification.permission || 'default';
  }
}

/**
 * Bunyi lonceng notifikasi lembut menggunakan Web Audio API tanpa ketergantungan berkas MP3 eksternal.
 */
export function playNotificationChime(priority = 'IMPORTANT') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = priority === 'URGENT' ? [587.33, 880, 1174.66] : [523.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.25);
    });
    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 900);
  } catch {
    // Abaikan jika kebijakan autoplay menahan audio sebelum interaksi pertama
  }
}

function hasSeenNotificationId(dedupeId) {
  if (!dedupeId) return false;
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEEN_NOTIF_IDS_KEY) || '[]');
    return Array.isArray(raw) && raw.includes(dedupeId);
  } catch {
    return false;
  }
}

function markSeenNotificationId(dedupeId) {
  if (!dedupeId) return;
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEEN_NOTIF_IDS_KEY) || '[]');
    const next = [dedupeId, ...(Array.isArray(raw) ? raw.filter((id) => id !== dedupeId) : [])].slice(0, 120);
    sessionStorage.setItem(SEEN_NOTIF_IDS_KEY, JSON.stringify(next));
  } catch {
    // Abaikan
  }
}

/**
 * Mengirim notifikasi tingkat sistem operasi (muncul di layar HP / bilah status di luar aplikasi)
 * selama pengguna masih dalam sesi login aktif.
 */
export async function dispatchOsNotification({
  id = '',
  title = 'PERFORMA ITPLN',
  body = '',
  priority = 'IMPORTANT',
  url = '/internal',
  actionLabel = 'Buka Portal Kinerja',
  force = false,
} = {}) {
  if (typeof window === 'undefined') return false;

  // Pastikan hanya mengirim notifikasi selama pengguna masih login (kecuali uji paksa)
  if (!force) {
    try {
      const activeUser = JSON.parse(localStorage.getItem('performa_user') || 'null');
      if (!activeUser?.email) return false;
    } catch {
      return false;
    }
    if (!isOsNotificationEnabledByUser()) return false;
    if (id && hasSeenNotificationId(id)) return false;
  }

  if (id) markSeenNotificationId(id);

  // Getaran perangkat seluler (Android)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(priority === 'URGENT' ? [220, 80, 220, 80, 300] : [160, 70, 180]);
    }
  } catch {
    // Abaikan
  }

  playNotificationChime(priority);

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  const tag = id || `performa-${Date.now()}`;
  const payload = {
    title,
    body,
    tag,
    priority,
    url,
    actionUrl: url,
    actionLabel,
  };

  try {
    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration?.());
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        icon: '/logo_pln.png',
        badge: '/logo_pln.png',
        tag,
        renotify: true,
        requireInteraction: priority === 'URGENT',
        vibrate: priority === 'URGENT' ? [260, 90, 260, 90, 340] : [180, 80, 220],
        data: { url, broadcastId: id || null },
        actions: [
          { action: 'open', title: actionLabel },
          { action: 'dismiss', title: 'Tutup' },
        ],
      });
      return true;
    }
    if (reg?.active) {
      reg.active.postMessage({ type: 'SHOW_OS_NOTIFICATION', payload });
      return true;
    }
  } catch {
    // Fallback ke konstruktor Notification standar
  }

  try {
    const n = new Notification(title, {
      body,
      icon: '/logo_pln.png',
       badge: '/logo_pln.png',
      tag,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
