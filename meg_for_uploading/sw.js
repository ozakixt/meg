const C='meguri-pf-v6';
const SHELL=['./','./index.html','./osm.js?v=11','./data/pokefuta.js?v=3','./transit.js?v=9','./layers.js?v=16','./sync.js?v=2','./route.js?v=4','./data/stores.csv','./data/rail-lines.json','./data/rail-lo.json','./data/rail/index.json','./manifest.webmanifest','./icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.origin===location.origin){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request,{ignoreSearch:u.pathname.endsWith('index.html')||u.pathname.endsWith('/')})));return}
  if(/unpkg\.com|fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.host)){e.respondWith(caches.match(e.request).then(m=>m||fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r})))}
});
