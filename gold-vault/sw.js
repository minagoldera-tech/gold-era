// يخلي البرنامج يفتح حتى لو النت قاطع
const CACHE="gold-vault-v12";
const SHELL=["./","./index.html","./app.js","./config.js","./manifest.json","./icon-192.png","./icon-512.png","./login-bg.jpg",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js","https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  if(u.hostname.includes("googleapis.com")&&!u.hostname.startsWith("fonts"))return; // Firestore/Auth traffic
  const sameOrigin=u.origin===location.origin;
  if(!(sameOrigin||u.hostname==="www.gstatic.com"||u.hostname==="cdnjs.cloudflare.com"||u.hostname.startsWith("fonts.")))return;
  // network first for the app's own files (so updates show), cache fallback when offline
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("./index.html"))));
});
