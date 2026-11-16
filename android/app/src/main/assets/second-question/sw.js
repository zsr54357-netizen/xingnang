const CACHE = 'second-question-v3';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/app.js',
  './src/api.js',
  './src/archivist.js',
  './src/crypto.js',
  './src/engine.js',
  './src/model.js',
  './src/prompts.js',
  './src/store.js',
  './src/tools.js',
  './src/ui.js',
  './src/memory/dossier.js',
  './src/memory/episodes.js',
  './src/memory/hypotheses.js',
  './src/memory/patterns.js',
  './src/memory/search.js',
  './src/views/chat.js',
  './src/views/diagnostics.js',
  './src/views/lock.js',
  './src/views/memory.js',
  './src/views/onboarding.js',
  './src/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const host = self.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    // Local shells serve fresh assets themselves; a cache only causes staleness.
    // Unregister, drop caches, then reload open pages so the next paint is fresh.
    event.waitUntil(
      self.registration
        .unregister()
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.clients.matchAll({ type: 'window' }))
        .then((clients) => {
          clients.forEach((client) => {
            if ('navigate' in client) client.navigate(client.url);
          });
        })
    );
    return;
  }
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network first: edits must show up on the next load. Cache is only the
  // offline fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
