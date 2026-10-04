const CACHE_VERSION = 'afghan-eats-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/restaurants.html',
  '/restaurant.html',
  '/manifest.json',
  '/config.js',
  '/assets/styles.css',
  '/assets/advanced.css',
  '/assets/app.js',
  '/assets/design-2026.css',
  '/assets/icons/afghan-eats-192.svg',
  '/assets/icons/afghan-eats-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isLiveDataRequest(request) {
  try {
    const url = new URL(request.url);
    return (
      url.pathname.startsWith('/api/') ||
      /\/api\//.test(url.pathname) ||
      url.hostname.includes('onrender.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com')
    );
  } catch {
    return true;
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (
    response.ok &&
    new URL(request.url).origin === self.location.origin
  ) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

function offlineNavigationFallback(url) {
  if (url.pathname === '/restaurants' || url.pathname.endsWith('/restaurants.html')) {
    return caches.match('/restaurants.html');
  }
  if (url.pathname === '/restaurant' || url.pathname.endsWith('/restaurant.html')) {
    return caches.match('/restaurant.html');
  }
  return caches.match('/index.html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (isLiveDataRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlineNavigationFallback(new URL(request.url)))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstStatic(request));
  }
});
