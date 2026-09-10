/// <reference lib="webworker" />
import { handleLocalApi } from './api.js';
import { CORE_FILES, CACHE_VERSION } from './cache-manifest.js';
declare const self: ServiceWorkerGlobalScope;
const CACHE = 'ddli-original-shell-' + CACHE_VERSION;
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('ddli-original-shell-') || key.startsWith('ddli-shell-')) &&
                key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(handleLocalApi(request));
    return;
  }
  // Do not send the legacy application's old API requests to its original host.
  if (/(^|\.)gotab\.cn$/.test(url.hostname) && url.pathname.startsWith('/api/')) {
    event.respondWith(handleLocalApi(request));
    return;
  }
  const offlineIcons: Record<string, string> = {
    '/icons/logo.svg': '/icons/logo.svg',
    '/sourceStore/website/01K2Q9SRK8MBSSQ80J24ESXZMT.svg': '/icons/history.svg',
    '/sourceStore/website/01J8J19PV7B4755AETNTX200KD.svg': '/icons/weather.svg',
    '/sourceStore/website/01K2Q95P53SEFB7XG2ZVD90KYK.svg': '/icons/qq.svg',
  };
  if (/(^|\.)gotab\.cn$/.test(url.hostname) && offlineIcons[url.pathname]) {
    const icon = offlineIcons[url.pathname];
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(icon)) || fetch(icon)),
    );
    return;
  }
  if (url.origin !== self.location.origin || request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.open(CACHE)).match('/index.html') as Promise<Response>,
      ),
    );
    return;
  }
  if (
    !/^\/(assets|icons|fonts|images|local|config)\//.test(url.pathname) &&
    !['/siteConfig.js', '/idleCallback.js', '/changeFavicon.js'].includes(url.pathname)
  )
    return;
  const response = caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('Offline resource not cached', { status: 503 });
    }
  });
  event.respondWith(response);
});
