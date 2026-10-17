// Offline support without stale app versions:
// - Pages (index.html) and data files: network first, saved copy only when offline.
// - Hashed build files (assets/*-abc123.js/css), icons, logo: cache first; their
//   names change with every build, so a cached copy is never out of date.
const CACHE = 'at-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const save = (req, res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const networkFirst = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')
    || url.pathname.includes('/data/') || url.pathname.endsWith('.webmanifest');
  if (networkFirst) {
    e.respondWith(fetch(req).then((r) => save(req, r)).catch(() => caches.match(req, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => save(req, r))));
  }
});
