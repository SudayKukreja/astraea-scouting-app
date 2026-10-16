const STATIC_CACHE = 'astraea-static-v20261016-004838';
const DYNAMIC_CACHE = 'astraea-dynamic-v20261016-004838';

const STATIC_ASSETS = [
  '/login',
  '/static/css/app.css',
  '/static/js/common.js',
  '/static/js/scout_form.js',
  '/static/js/pit_scout.js',
  '/static/js/scouter_dashboard.js',
  '/static/js/admin_dashboard.js',
  '/static/img/logo.png'
];

const CACHEABLE_APIS = ['/api/scouter/assignments', '/api/admin/matches', '/api/admin/teams', '/api/admin/scouters'];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', evt => {
  if (evt.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    return cached || offlinePage();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title>
    <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#040a1c;color:#e6eeff;font-family:system-ui,sans-serif;text-align:center">
    <div><h1>You're offline</h1><p style="color:#8ea3cc">Reconnect to continue. Scout reports saved offline will sync automatically.</p>
    <button onclick="location.reload()" style="padding:12px 24px;border:0;border-radius:10px;background:#3b7bff;color:#fff;font-weight:600">Try Again</button></div></body>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

self.addEventListener('fetch', evt => {
  const { request } = evt;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/static/')) {
    evt.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate' || CACHEABLE_APIS.some(api => url.pathname.startsWith(api))) {
    evt.respondWith(networkFirst(request));
  }
});
