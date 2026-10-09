// KYS:GO as an installed app: the game's own files are cached so it starts fast and launches like an app. Code and
// settings are fetched fresh when online (updates arrive right away); images and models come from the cache first.
// Anything on another server (accounts, multiplayer relays) is never touched.
const CACHE = 'kysgo-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const heavy = /\.(jpg|png|bin|webp)$/.test(u.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (heavy) { const hit = await c.match(e.request); if (hit) return hit; }
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch (err) { const hit = await c.match(e.request); if (hit) return hit; throw err; }
  })());
});
