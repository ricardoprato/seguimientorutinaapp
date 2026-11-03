// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'rutina-v4';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/store.js', 'js/progression.js', 'js/export.js', 'js/presets.js', 'js/ids.js', 'js/file-sync.js', 'js/schema.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates land when online; cache when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request)),
  );
});
