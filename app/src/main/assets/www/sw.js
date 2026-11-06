/* Kitchen Ledger offline support: app files come from the network when online, from the cache when offline. */
const CACHE = "kl-v1";
const APP = ["./", "./index.html", "./logic.js", "./i18n.js", "./lang-de.js", "./lang-fr.js", "./web.js", "./manifest.json", "./icon-192.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (/cdn\.jsdelivr\.net|tessdata|themealdb\.com\/images|openfoodfacts\.org\/images/.test(u.href)) {
    // libraries and pictures: cache first
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE + "-ext").then(x => x.put(e.request, c)); } return r; })));
  }
});
