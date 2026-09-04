const CACHE="aprils-signature-offline-v20260903-stable";
const CORE=["/","/index.html","/css/style.css","/js/script.js","/js/supabase-config.js","/js/supabase-client.js","/admin/index.html","/admin/admin.js","/admin/commerce-admin.js","/admin/stability-core.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(async u=>{try{const r=await fetch(u,{cache:"reload"});if(r.ok)await c.put(u,r.clone())}catch(_){}}))).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys(en(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  event.respondWith(fetch(req,{cache:"no-store"}).then(res=>{if(res&&res.ok&&req.destination!=="video")caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;}).catch(()=>caches.match(req).then(r=>r||caches.match("/index.html"))));
});
