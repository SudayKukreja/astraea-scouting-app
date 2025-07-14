const CACHE_NAME = 'astraea-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/script.js',
  '/static/logo.png',
  '/static/logo2.png',
  // add any other static assets your app needs to work offline here
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return; // Only cache GET requests

  evt.respondWith(
    caches.match(evt.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(evt.request)
        .then(response => {
          // Cache new files
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(evt.request, response.clone());
            return response;
          });
        }).catch(() => {
          // Optional: return offline fallback page if you have one
        });
    })
  );
});
