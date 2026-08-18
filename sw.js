const CACHE='intorna-pixels-v11-comercial-orcamentos';
const ASSETS=[
  '/','/index.html','/portal/','/portal/index.html','/admin/','/admin/index.html','/admin/admin.js','/admin/styles.css',
  '/app/','/app/index.html','/app/app.js','/app/bootstrap-cloud.js','/app/features-v6.js','/app/features-v7.js','/app/features-v8.js','/app/features-v9.js','/app/features-v10.js','/app/features-v11.js','/app/styles.css','/app/styles-v6.css','/app/styles-v7.css','/app/styles-v8.css','/app/styles-v9.css','/app/styles-v10.css','/app/styles-v11.css','/cliente/','/cliente/index.html','/cliente/portal.js','/cliente/styles.css',
  '/shared/supabase-config.js','/shared/cloud.js',
  '/assets/logo.svg','/assets/icon.svg','/assets/logo-horizontal.png','/manifest.webmanifest'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});
