const CACHE_NAME = 'afghan-eats-safe-static-v1';
const CACHE_PREFIX = 'afghan-eats-';
const INSTALL_ASSETS = [
  '/manifest.json',
  '/assets/icons/afghan-eats-180.png',
  '/assets/icons/afghan-eats-192.png',
  '/assets/icons/afghan-eats-512.png'
];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(INSTALL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isSafeStaticAsset(request) {
  if (request.method !== 'GET' || !STATIC_DESTINATIONS.has(request.destination)) return false;

  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
  } catch {
    return false;
  }
}

async function fetchSafeStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      response.ok &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/json') &&
      !contentType.includes('text/json')
    ) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  // Customer pages, checkout, orders, availability, prices, promotions, APIs,
  // configuration, and all non-asset requests always use the network/browser.
  if (!isSafeStaticAsset(event.request)) return;
  event.respondWith(fetchSafeStaticAsset(event.request));
});
