const CACHE_NAME = 'blackbook-v1';
const STATIC_ASSETS = [
  '/BlackBook/',
  '/BlackBook/index.html',
  '/BlackBook/style.css',
  '/BlackBook/app.js',
  '/BlackBook/modules/firebase.js',
  '/BlackBook/modules/settlement.js',
  '/BlackBook/modules/ui.js',
  '/BlackBook/modules/session.js',
  '/BlackBook/manifest.json',
  '/BlackBook/icon-192.png',
  '/BlackBook/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/BlackBook/index.html');
      });
    })
  );
});
