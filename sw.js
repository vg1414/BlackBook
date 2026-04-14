const CACHE_NAME = 'blackbook-v6';
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
  '/BlackBook/favicon.png',
  '/BlackBook/apple-touch-icon-180x180.png'
];

// Install – cache static assets (en och en, så en miss inte kraschar allt)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => {/* ignorera enskilda missar */})
        )
      )
    )
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

// Fetch – network-first for everything (fallback to cache offline)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase/Google requests → network only, no cache
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Everything else → network-first, cache as fallback
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(request).then(cached => {
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('/BlackBook/index.html');
        }
      });
    })
  );
});
