const CACHE='intorna-pixels-rc20-auto-production-security-launcher';
const CORE=[
 '/', '/index.html','/portal/','/portal/index.html','/admin/','/admin/index.html','/admin/admin.js','/admin/styles.css',
 '/app/','/app/index.html','/app/app.js','/app/bootstrap-cloud.js','/app/features-v6.js','/app/features-v7.js','/app/features-v11.js','/app/features-v12.js','/app/features-v13.js','/app/features-v19.js','/app/features-v20.js','/app/features-waha-test.js',
 '/app/styles.css','/app/styles-v6.css','/app/styles-v7.css','/app/features-v11.css',
 '/cliente/','/cliente/index.html','/cliente/portal.js','/cliente/styles.css',
 '/shared/supabase-config.js','/shared/cloud.js','/shared/platform.js','/shared/tenant-bridge.js','/shared/rc20-master.js','/shared/rc20-studio.js',
 '/assets/logo.svg','/assets/icon.svg','/assets/logo-horizontal.png','/manifest.webmanifest'
];
async function warm(){
 const c=await caches.open(CACHE);
 const r=await Promise.allSettled(CORE.map(async p=>{const x=await fetch(p,{cache:'reload'});if(!x.ok)throw new Error(`${p}:${x.status}`);await c.put(p,x)}));
 const f=r.filter(x=>x.status==='rejected');if(f.length)console.warn(`RC20: ${f.length} recurso(s) não entraram no cache inicial.`);
}
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(warm())});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
async function networkFirst(req){try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok)caches.open(CACHE).then(c=>c.put(req,r.clone())).catch(()=>{});return r}catch(e){const c=await caches.match(req);if(c)return c;throw e}}
async function cacheFirst(req){const c=await caches.match(req);if(c)return c;const r=await fetch(req);if(r&&r.ok)caches.open(CACHE).then(x=>x.put(req,r.clone())).catch(()=>{});return r}
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(networkFirst(e.request).catch(async()=>await caches.match(e.request)||await caches.match('/portal/')));return}
 if(/\.(js|css|html|json|webmanifest)$/.test(u.pathname)){e.respondWith(networkFirst(e.request));return}
 e.respondWith(cacheFirst(e.request));
});
