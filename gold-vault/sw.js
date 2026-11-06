// يخلي البرنامج يفتح حتى لو النت قاطع، ودايماً يجيب آخر نسخة لما النت موجود
const CACHE="gold-vault-v16";
const SHELL=["./","./index.html","./app.js?v=16","./config.js?v=16","./manifest.json","./icon-192.png","./icon-512.png","./login-bg.jpg","./ingot.svg","./gold-bars.png",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
"https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  if(u.hostname.includes("googleapis.com")&&!u.hostname.startsWith("fonts"))return; // Firestore/Auth traffic
  if(u.pathname.endsWith("version.json"))return;                                  // always straight from the network
  const same=u.origin===location.origin;
  if(!(same||u.hostname==="www.gstatic.com"||u.hostname==="cdnjs.cloudflare.com"))return;
  // network first, skipping the browser's HTTP cache for our own files; cached copy only when offline
  const net=same?fetch(e.request.url,{cache:"no-store",credentials:"same-origin"}):fetch(e.request);
  e.respondWith(net.then(r=>{if(r.ok&&!r.redirected){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("./index.html"))));
});
