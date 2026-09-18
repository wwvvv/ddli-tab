/// <reference lib="webworker" />
import { handleLocalApi } from './api.js';
import { CORE_FILES, CACHE_VERSION } from './cache-manifest.js';
declare const self: ServiceWorkerGlobalScope;
const CACHE = 'ddli-original-shell-' + CACHE_VERSION;
// 新壳 /os 命名空间与 v1 API 的精确允许列表。
function isPassthroughPath(pathname: string): boolean {
  return (
    pathname === '/os' || pathname.startsWith('/os/') ||
    pathname === '/api/v1' || pathname.startsWith('/api/v1/')
  );
}
// 旧版 SPA 的导航入口；仅这些路径允许用缓存的 index.html 兜底。
function isLegacyShellPath(pathname: string): boolean {
  return (
    ['/', '/index.html', '/newtab.html', '/popup.html', '/console', '/console/'].includes(pathname) ||
    pathname.startsWith('/s/')
  );
}
self.addEventListener('install', (event) => {
  // First install activates normally; updates wait until all old tabs close.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE_FILES)));
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
  // M1 允许列表：新壳路由与 v1 API 一律 passthrough，旧 SW 不拦截、不缓存、
  // 也不用旧 HTML 兜底（02-ARCHITECTURE 路径隔离；/os 命名空间迁移期使用）。
  if (url.origin === self.location.origin && isPassthroughPath(url.pathname)) return;
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
    if (!isLegacyShellPath(url.pathname)) return;
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        // Keep the HTML entry and its modules on the same installed version.
        return (
          (await cache.match(url.pathname)) || (await cache.match('/index.html')) || fetch(request)
        );
      }),
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
