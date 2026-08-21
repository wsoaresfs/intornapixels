const CACHE = 'intorna-pixels-rc19-realtime-hardened-final';

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
  '/app/features-v11.js',
  '/app/features-v12.js',
  '/app/features-v13.js',
  '/app/features-v19.js',
  '/app/features-waha-test.js',
  '/app/styles.css',
  '/app/styles-v6.css',
  '/app/styles-v7.css',
  '/app/features-v11.css',
  '/cliente/',
  '/cliente/index.html',
  '/cliente/portal.js',
  '/cliente/styles.css',
  '/shared/supabase-config.js',
  '/shared/cloud.js',
  '/shared/platform.js',
  '/shared/tenant-bridge.js',
  '/shared/rc19-master.js',
  '/shared/rc19-studio.js',
  '/assets/logo.svg',
  '/assets/icon.svg',
  '/assets/logo-horizontal.png',
  '/manifest.webmanifest'
];

async function warmCache(){
  const cache = await caches.open(CACHE);
  const results = await Promise.allSettled(
    CORE.map(async path => {
      const response = await fetch(path, {cache:'reload'});
      if(!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      await cache.put(path, response);
    })
  );
  const failed = results.filter(x => x.status === 'rejected');
  if(failed.length) console.warn(`RC19: ${failed.length} recurso(s) não entraram no cache inicial.`);
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(warmCache());
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    ))
  ]));
});

async function networkFirst(request){
  try{
    const response = await fetch(request, {cache:'no-store'});
    if(response && response.ok){
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(()=>{});
    }
    return response;
  }catch(error){
    const cached = await caches.match(request);
    if(cached) return cached;
    throw error;
  }
}

async function cacheFirst(request){
  const cached = await caches.match(request);
  if(cached) return cached;
  const response = await fetch(request);
  if(response && response.ok){
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(request, copy)).catch(()=>{});
  }
  return response;
}

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  if(event.request.mode === 'navigate'){
    event.respondWith(networkFirst(event.request).catch(async()=>{
      return (await caches.match(event.request)) || (await caches.match('/portal/'));
    }));
    return;
  }

  if(
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.webmanifest')
  ){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
