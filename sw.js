const CACHE_NAME = 'astraea-cache-20251129-192037'; // Updated version
const STATIC_CACHE = 'astraea-static-v20251129-192037';
const DYNAMIC_CACHE = 'astraea-dynamic-v20251129-192037';

// Essential files for offline functionality
const STATIC_ASSETS = [
  // Core pages
  '/',
  '/login',
  '/dashboard',
  '/admin',
  '/scout',
  
  // Static assets
  '/static/style.css',
  '/static/dashboard.css',
  '/static/login.css',
  '/static/script.js',
  '/static/admin_dashboard.js',
  '/static/scouter_dashboard.js',
  '/static/logo.png',
  '/static/logo2.png',
  
  // Templates (cached as fallbacks)
  '/offline.html'
];

// API endpoints that should work offline with cached data
const OFFLINE_CAPABLE_APIS = [
  '/api/scouter/assignments',
  '/api/admin/matches',
  '/api/admin/scouters',
  '/api/admin/assignments',
  '/api/admin/teams'
];

// Install event - cache static assets
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  evt.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('[ServiceWorker] Dynamic cache ready');
        return cache;
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== CACHE_NAME) {
          console.log('[ServiceWorker] Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (evt) => {
  const { request } = evt;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (isNavigationRequest(request)) {
    evt.respondWith(handleNavigationRequest(request));
  } else if (isAPIRequest(url.pathname)) {
    evt.respondWith(handleAPIRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    evt.respondWith(handleStaticAsset(request));
  } else {
    evt.respondWith(handleGenericRequest(request));
  }
});

// Check if request is a navigation request
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Check if request is for an API endpoint
function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

// Check if request is for a static asset
function isStaticAsset(pathname) {
  return pathname.startsWith('/static/') || 
         pathname.endsWith('.css') || 
         pathname.endsWith('.js') || 
         pathname.endsWith('.png') || 
         pathname.endsWith('.jpg') || 
         pathname.endsWith('.ico');
}

// Handle navigation requests (pages)
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed for navigation, trying cache');
    
    // Try to get from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to appropriate offline page based on URL
    const url = new URL(request.url);
    if (url.pathname === '/login' || url.pathname.startsWith('/login')) {
      return await caches.match('/login') || createOfflineResponse('Login Offline', 'Login functionality requires internet connection.');
    } else if (url.pathname === '/admin' || url.pathname.startsWith('/admin')) {
      return await caches.match('/admin') || createOfflineResponse('Admin Offline', 'Admin dashboard cached data available.');
    } else if (url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard')) {
      return await caches.match('/dashboard') || createOfflineResponse('Dashboard Offline', 'Your assignments are cached and available.');
    } else if (url.pathname === '/scout' || url.pathname.startsWith('/scout')) {
      return await caches.match('/scout') || createOfflineResponse('Scout Offline', 'Scouting forms work offline and will sync when online.');
    }
    
    // Default fallback
    return await caches.match('/') || createOfflineResponse('Offline', 'You are currently offline.');
  }
}

// Handle API requests
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  // For POST requests (like form submissions), try network first, then store for later sync
  if (request.method === 'POST') {
    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      console.log('[ServiceWorker] POST request failed, storing for sync');
      
      // Store failed POST requests for background sync
      await storeFailedRequest(request);
      
      // Return a success response to prevent user confusion
      return new Response(JSON.stringify({ 
        success: true, 
        offline: true,
        message: 'Data saved offline and will sync when online' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // For GET requests, try cache first for offline-capable APIs
  if (OFFLINE_CAPABLE_APIS.some(api => url.pathname.startsWith(api))) {
    try {
      // Try network first, but with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const networkResponse = await fetch(request, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      // Cache successful API responses
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      console.log('[ServiceWorker] API network failed, trying cache');
      
      // Return cached data if available
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Add offline indicator to cached API responses
        const data = await cachedResponse.json();
        return new Response(JSON.stringify({
          ...data,
          _offline: true,
          _cachedAt: cachedResponse.headers.get('date')
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Return empty data structure for failed API calls
      return new Response(JSON.stringify({ 
        error: 'Offline - no cached data available',
        offline: true 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // For other API requests, just try network
  return fetch(request);
}

// Handle static assets (CSS, JS, images)
async function handleStaticAsset(request) {
  // Cache first strategy for static assets
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache static assets
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Static asset not found:', request.url);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Handle other requests
async function handleGenericRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Not available offline', { status: 404 });
  }
}

// Create offline response for pages
function createOfflineResponse(title, message) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .offline-container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        .offline-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { color: #374151; margin-bottom: 16px; }
        p { color: #6b7280; line-height: 1.5; }
        .retry-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

// Store failed requests for background sync
async function storeFailedRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    // Store in IndexedDB or fallback to cache
    const cache = await caches.open('failed-requests');
    const response = new Response(JSON.stringify(requestData));
    await cache.put(`failed-${Date.now()}`, response);
    
    console.log('[ServiceWorker] Stored failed request for sync');
  } catch (error) {
    console.error('[ServiceWorker] Failed to store request:', error);
  }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncFailedRequests());
  }
});

// Sync failed requests when online
async function syncFailedRequests() {
  try {
    const cache = await caches.open('failed-requests');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const requestData = await response.json();
        
        // Retry the failed request
        const retryResponse = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (retryResponse.ok) {
          // Remove from failed requests cache
          await cache.delete(request);
          console.log('[ServiceWorker] Synced failed request:', requestData.url);
        }
      } catch (error) {
        console.log('[ServiceWorker] Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Background sync failed:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    // Send cache status to client
    getCacheStatus().then(status => {
      event.ports[0].postMessage(status);
    });
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

// Get cache status
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = keys.length;
    }
    
    return status;
  } catch (error) {
    return { error: error.message };
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}