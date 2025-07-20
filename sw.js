const CACHE_NAME = 'astraea-cache-20250719-215226'; // Increment version number when you deploy
const FILES_TO_CACHE = [
  '/',
  '/static/style.css',
  '/static/script.js',
  '/static/logo.png',
  '/static/logo2.png',
];

// Install event - cache resources
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
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
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - network first strategy for better updates
self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  // For navigation requests and API calls, always go network first
  if (evt.request.mode === 'navigate' || evt.request.url.includes('/submit')) {
    evt.respondWith(
      fetch(evt.request)
        .then(response => {
          // Cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(evt.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(evt.request);
        })
    );
    return;
  }

  // For static resources, use cache first but with network update
  evt.respondWith(
    caches.match(evt.request).then(cachedResponse => {
      const fetchPromise = fetch(evt.request)
        .then(networkResponse => {
          // Update cache with fresh content
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(evt.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, return cached version if available
          return cachedResponse;
        });

      // Return cached version immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});