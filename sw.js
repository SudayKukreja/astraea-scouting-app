const CACHE_NAME = 'astraea-cache-20250812-200445'; // Keep your existing version
const STATIC_CACHE = 'astraea-static-v20250812-200445';
const DYNAMIC_CACHE = 'astraea-dynamic-v20250812-200445';

// Keep your existing STATIC_ASSETS - they're perfect
const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/admin',
  '/scout',
  '/static/style.css',
  '/static/dashboard.css',
  '/static/login.css',
  '/static/script.js',
  '/static/admin_dashboard.js',
  '/static/scouter_dashboard.js',
  '/static/logo.png',
  '/static/logo2.png',
  '/offline.html'
];

// Keep your existing OFFLINE_CAPABLE_APIS
const OFFLINE_CAPABLE_APIS = [
  '/api/scouter/assignments',
  '/api/admin/matches',
  '/api/admin/scouters',
  '/api/admin/assignments',
  '/api/admin/teams'
];

// Keep your existing install and activate events - they're good!
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
      }),
      // NEW: Initialize IndexedDB for offline submissions
      initializeOfflineDB()
    ])
  );
  self.skipWaiting();
});

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

// ENHANCED: Improved fetch handler with better offline support
self.addEventListener('fetch', (evt) => {
  const { request } = evt;
  const url = new URL(request.url);

  // Skip non-GET requests for chrome-extension
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // NEW: Special handling for scout form submissions
  if (request.method === 'POST' && url.pathname === '/submit') {
    evt.respondWith(handleScoutSubmission(request));
    return;
  }

  // Handle different types of requests (keep your existing logic but enhanced)
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

// Keep your existing helper functions
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

function isStaticAsset(pathname) {
  return pathname.startsWith('/static/') || 
         pathname.endsWith('.css') || 
         pathname.endsWith('.js') || 
         pathname.endsWith('.png') || 
         pathname.endsWith('.jpg') || 
         pathname.endsWith('.ico');
}

// Keep your existing navigation handler - it's great
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed for navigation, trying cache');
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
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
    
    return await caches.match('/') || createOfflineResponse('Offline', 'You are currently offline.');
  }
}

// ENHANCED: Better API request handling with retry logic
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  // For POST requests, try network with better error handling
  if (request.method === 'POST') {
    try {
      const response = await fetch(request, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      return response;
    } catch (error) {
      console.log('[ServiceWorker] POST request failed:', error.message);
      
      // Store for later sync if it's not a critical auth request
      if (!url.pathname.includes('/login') && !url.pathname.includes('/logout')) {
        await storeOfflineSubmission(request);
        
        return new Response(JSON.stringify({ 
          success: true, 
          offline: true,
          message: 'Data saved offline and will sync when online' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // For auth requests, return error
      return new Response(JSON.stringify({ 
        error: 'Authentication requires internet connection',
        offline: true 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Keep your existing GET request logic but with better timeout
  if (OFFLINE_CAPABLE_APIS.some(api => url.pathname.startsWith(api))) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased to 5 seconds
      
      const networkResponse = await fetch(request, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      console.log('[ServiceWorker] API network failed, trying cache for:', url.pathname);
      
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        const data = await cachedResponse.json();
        return new Response(JSON.stringify({
          ...data,
          _offline: true,
          _message: 'Showing cached data - may not be current'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Offline - no cached data available',
        offline: true 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return fetch(request);
}

// Keep your existing static asset handler
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
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

// Keep your existing generic request handler
async function handleGenericRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
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

// Keep your existing createOfflineResponse - it's perfect
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

// NEW: Handle scout form submissions with offline support
async function handleScoutSubmission(request) {
  try {
    // Try network first with timeout
    const response = await fetch(request.clone(), {
      signal: AbortSignal.timeout(15000) // 15 seconds for form submission
    });
    
    if (response.ok) {
      return response;
    }
    
    throw new Error(`Server responded with ${response.status}`);
  } catch (error) {
    console.log('[ServiceWorker] Scout submission failed, storing offline:', error.message);
    
    // Store the submission for later sync
    await storeOfflineSubmission(request);
    
    // Return success response to prevent form errors
    return new Response(JSON.stringify({ 
      status: 'success',
      offline: true,
      message: 'Scout report saved offline. Will sync when connection is restored.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// NEW: Initialize IndexedDB for offline storage
async function initializeOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AstraeaScoutingDB', 1);
    
    request.onerror = () => {
      console.error('[ServiceWorker] IndexedDB failed to open');
      resolve(); // Don't fail the service worker installation
    };
    
    request.onsuccess = () => {
      console.log('[ServiceWorker] IndexedDB initialized');
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('submissions')) {
        const store = db.createObjectStore('submissions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

// NEW: Store offline submissions
async function storeOfflineSubmission(request) {
  try {
    const formData = await request.json();
    
    const db = await openDB();
    const transaction = db.transaction(['submissions'], 'readwrite');
    const store = transaction.objectStore('submissions');
    
    const submission = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      data: formData,
      timestamp: Date.now(),
      synced: false
    };
    
    await store.add(submission);
    
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_SUBMISSION_STORED',
        timestamp: submission.timestamp
      });
    });
    
    console.log('[ServiceWorker] Stored offline submission');
  } catch (error) {
    console.error('[ServiceWorker] Failed to store offline submission:', error);
  }
}

// NEW: Open IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AstraeaScoutingDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ENHANCED: Better background sync
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);
  
  if (event.tag === 'scout-submissions-sync') {
    event.waitUntil(syncOfflineSubmissions());
  } else if (event.tag === 'background-sync') {
    // Keep your existing sync logic too
    event.waitUntil(syncFailedRequests());
  }
});

// NEW: Sync offline scout submissions
async function syncOfflineSubmissions() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['submissions'], 'readwrite');
    const store = transaction.objectStore('submissions');
    
    const unsyncedSubmissions = await store.index('synced').getAll(false);
    let syncedCount = 0;
    
    for (const submission of unsyncedSubmissions) {
      try {
        const response = await fetch(submission.url, {
          method: submission.method,
          headers: submission.headers,
          body: JSON.stringify(submission.data)
        });
        
        if (response.ok) {
          // Mark as synced
          submission.synced = true;
          submission.syncedAt = Date.now();
          await store.put(submission);
          syncedCount++;
          
          console.log('[ServiceWorker] Synced submission from:', new Date(submission.timestamp));
        }
      } catch (error) {
        console.log('[ServiceWorker] Failed to sync submission:', error);
        // Will try again on next sync
      }
    }
    
    if (syncedCount > 0) {
      // Notify clients of successful sync
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SUBMISSIONS_SYNCED',
          count: syncedCount
        });
      });
    }
    
    console.log(`[ServiceWorker] Sync complete: ${syncedCount}/${unsyncedSubmissions.length} submissions synced`);
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Keep your existing syncFailedRequests function
async function syncFailedRequests() {
  try {
    const cache = await caches.open('failed-requests');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const requestData = await response.json();
        
        const retryResponse = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (retryResponse.ok) {
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

// ENHANCED: Better message handling
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0]?.postMessage(status);
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'GET_OFFLINE_STATUS':
      getOfflineStatus().then(status => {
        event.ports[0]?.postMessage(status);
      });
      break;
      
    case 'FORCE_SYNC':
      if ('sync' in self.registration) {
        self.registration.sync.register('scout-submissions-sync');
      }
      break;
  }
});

// NEW: Get offline submission status
async function getOfflineStatus() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['submissions'], 'readonly');
    const store = transaction.objectStore('submissions');
    
    const allSubmissions = await store.getAll();
    const pendingSubmissions = allSubmissions.filter(s => !s.synced);
    
    return {
      totalOfflineSubmissions: allSubmissions.length,
      pendingSync: pendingSubmissions.length,
      lastSubmission: allSubmissions.length > 0 ? Math.max(...allSubmissions.map(s => s.timestamp)) : null
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Keep your existing cache status function
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

// Keep your existing clear cache function
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}