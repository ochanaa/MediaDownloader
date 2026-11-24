/**
 * MediaDrop Service Worker (v4 - Clean Streaming Pass-through)
 * Never intercepts /api/ downloads or streaming endpoints; always uses Network-First for shell assets.
 */

const CACHE_NAME = 'mediadrop-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/security.js',
  './js/engine.js',
  './js/playlist.js',
  './js/player.js',
  './js/history.js',
  './assets/jszip.min.js',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Cache prefetch note:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // NEVER intercept streaming/API/download endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/.netlify/')
  ) {
    return;
  }

  // Network-first for all app files so updates apply immediately on redeploy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
