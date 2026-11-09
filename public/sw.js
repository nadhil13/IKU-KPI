/**
 * Service Worker Resmi PERFORMA ITPLN (PWA Android / iOS / Desktop & Notifikasi Layar Kunci OS).
 * Menggunakan strategi Network-First dengan fallback cache agar pembaruan kode selalu mutakhir,
 * sekaligus menangani pengiriman notifikasi sistem di luar aplikasi (layar HP / status bar).
 */
const CACHE_NAME = 'performa-itpln-pwa-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_pln.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      } catch {
        // Abaikan kegagalan pembersihan cache lama
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Jangan intercept endpoint API atau stream SSE
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // Network-first agar rilis terbaru selalu dimuat, fallback ke cache bila offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const indexCached = await caches.match('/index.html');
          if (indexCached) return indexCached;
        }
        return new Response('Mode Luring PERFORMA ITPLN', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
  );
});

async function displaySystemNotification(payload = {}) {
  const title = String(payload.title || 'PERFORMA ITPLN');
  const body = String(payload.body || payload.message || 'Ada pembaruan kinerja baru pada akun Anda.');
  const tag = String(payload.tag || `performa-notif-${Date.now()}`);
  const targetUrl = String(payload.url || payload.actionUrl || '/internal');
  const priority = String(payload.priority || 'IMPORTANT').toUpperCase();

  const options = {
    body,
    icon: '/logo_pln.png',
    badge: '/logo_pln.png',
    tag,
    renotify: true,
    requireInteraction: priority === 'URGENT',
    vibrate: priority === 'URGENT' ? [260, 90, 260, 90, 340] : [180, 80, 220],
    timestamp: Date.now(),
    data: {
      url: targetUrl,
      broadcastId: payload.broadcastId || null,
      createdAt: new Date().toISOString(),
    },
    actions: [
      { action: 'open', title: payload.actionLabel || 'Buka Portal Kinerja' },
      { action: 'dismiss', title: 'Tutup' },
    ],
  };

  return self.registration.showNotification(title, options);
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SHOW_OS_NOTIFICATION') {
    event.waitUntil(displaySystemNotification(data.payload || {}));
  } else if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Siaran Instruksi PERFORMA ITPLN',
      body: event.data ? event.data.text() : 'Instruksi baru dari Superadmin PRP.',
    };
  }
  event.waitUntil(displaySystemNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification?.data?.url || '/internal';
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK_NAVIGATE',
            url: targetUrl,
            broadcastId: event.notification?.data?.broadcastId || null,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
