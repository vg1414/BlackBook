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

// Install – cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch – cache-first for static, network-first for Firebase
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase requests → network-first, no cache
  if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/BlackBook/index.html');
        }
      });
    })
  );
});
