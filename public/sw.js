const CACHE = 'intorna-pixels-v7-7-vercel';
const CORE = [
  '/',
  '/index.html',
  '/portal/',
  '/portal/index.html',
  '/admin/',
  '/admin/index.html',
  '/admin/admin.js',
  '/admin/styles.css',
  '/app/',
  '/app/index.html',
  '/app/app.js',
  '/app/bootstrap-cloud.js',
  '/app/features-v6.js',
  '/app/features-v7.js',
  '/app/features-waha-test.js',
  '/app/styles.css',
  '/app/styles-v6.css',
  '/app/styles-v7.css',
  '/app/styles-waha-test.css',
  '/cliente/',
  '/cliente/index.html',
  '/cliente/portal.js',
  '/cliente/styles.css',
  '/shared/supabase-config.js',
  '/shared/cloud.js',
  '/shared/platform.js',
  '/shared/tenant-bridge.js',
  '/assets/logo.svg',
  '/assets/icon.svg',
  '/assets/logo-horizontal.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Nunca intercepte Supabase, CDN ou APIs externas.
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || (await caches.match('/portal/')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
