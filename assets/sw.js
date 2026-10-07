const CACHE_VERSION = 'afghan-eats-v14';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/restaurants.html',
  '/restaurant.html',
  '/manifest.json',
  '/tools/resolve-coordinates.html',
  '/assets/styles.css',
  '/assets/advanced.css',
  '/assets/app.js',
  '/assets/design-2026.css',
  '/assets/icons/afghan-eats-192.png',
  '/assets/icons/afghan-eats-512.png'
];

const API_HOST = 'afghaneats-api.onrender.com';
const NETWORK_ONLY_HOST_SUFFIXES = [
  'onrender.com',
  'firebaseio.com',
  'firebaseapp.com',
  'googleapis.com',
  'google.com',
  'gstatic.com',
  'googleusercontent.com'
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

function hostMatches(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function isNetworkOnlyRequest(request) {
  try {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    if (hostname === API_HOST) return true;
    if (url.pathname === '/config.js') return true;
    if (url.pathname.startsWith('/api/') || /\/api\//.test(url.pathname)) return true;

    return NETWORK_ONLY_HOST_SUFFIXES.some((suffix) => hostMatches(hostname, suffix));
  } catch {
    return true;
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (
      response.ok &&
      new URL(request.url).origin === self.location.origin
    ) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[Afghan Eats] Cache-first fetch failed:', request.url, error);
    throw error;
  }
}

async function networkFirstData(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
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

  // Never intercept/cache API, Render, Firebase, or Google requests.
  if (isNetworkOnlyRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => offlineNavigationFallback(new URL(request.url)))
    );
    return;
  }

  const url = new URL(request.url);

  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/data/')
  ) {
    event.respondWith(networkFirstData(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstStatic(request));
  }
});
