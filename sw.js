const CACHE='intorna-rc21-v1';
const CORE=[
 '/','/app/','/app/index.html','/app/app.js','/app/bootstrap-cloud.js','/app/features-v6.js','/app/features-v7.js','/app/features-v11.js','/app/features-v12.js','/app/features-v13.js','/app/features-v19.js','/app/features-v20.js','/app/features-v21.js','/app/features-waha-test.js',
 '/shared/supabase-config.js','/shared/cloud.js','/shared/platform.js','/shared/tenant-bridge.js','/shared/rc20-master.js','/shared/rc20-studio.js',
 '/flow-bridge/IntornaFlowBridge-RC21.zip','/launcher/IntornaLauncher-RC21.zip'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 e.respondWith((async()=>{try{const r=await fetch(e.request);const c=await caches.open(CACHE);if(r&&r.ok)c.put(e.request,r.clone());return r}catch(_){return (await caches.match(e.request))||Response.error()}})());
});
