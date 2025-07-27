const CACHE_NAME = 'astraea-cache-20250726-210830'; // Increment version number when you deploy
const FILES_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/script.js',
  '/static/logo.png',
  '/static/logo2.png',
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
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  if (evt.request.mode === 'navigate' || evt.request.url.includes('/submit')) {
    evt.respondWith(
      fetch(evt.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(evt.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(evt.request);
        })
    );
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then(cachedResponse => {
      const fetchPromise = fetch(evt.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(evt.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});