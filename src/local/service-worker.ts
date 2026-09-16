/// <reference lib="webworker" />
import { handleLocalApi } from './api.js';
import { CORE_FILES, CACHE_VERSION } from './cache-manifest.js';
declare const self: ServiceWorkerGlobalScope;
const CACHE = 'ddli-original-shell-' + CACHE_VERSION;
const coreFiles = new Set(CORE_FILES);
// Reserved server/OS routes must never receive legacy API envelopes or HTML.
// This is migration isolation, not authentication or a reverse proxy.
const networkNamespaces = [
  '/api/v1',
  '/os',
  '/_next',
  '/auth',
  '/admin',
  '/media',
  '/store',
  '/gallery',
  '/settings',
  '/app',
  '/apps',
  '/launch',
];
const offlineIcons: Record<string, string> = {
  '/icons/logo.svg': '/icons/logo.svg',
  '/sourceStore/website/01K2Q9SRK8MBSSQ80J24ESXZMT.svg': '/icons/history.svg',
  '/sourceStore/website/01J8J19PV7B4755AETNTX200KD.svg': '/icons/weather.svg',
  '/sourceStore/website/01K2Q95P53SEFB7XG2ZVD90KYK.svg': '/icons/qq.svg',
};

function isNetworkNamespace(pathname: string): boolean {
  // Recognize encoded equivalents too; malformed paths belong to the server.
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return networkNamespaces.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function legacyDocument(pathname: string): string | undefined {
  if (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/console' ||
    pathname === '/console/' ||
    pathname.startsWith('/s/')
  )
    return '/index.html';
  if (pathname === '/newtab.html' || pathname === '/popup.html') return pathname;
  return undefined;
}

function bypassCache(request: Request): boolean {
  // Ordinary browser reloads use no-cache/reload. Keep the known legacy shell
  // version-pinned even then, so an offline refresh still works.
  return (
    request.cache === 'no-store' ||
    ['Authorization', 'Range', 'RSC', 'Next-Router-State-Tree', 'Next-Router-Prefetch'].some((name) =>
      request.headers.has(name),
    ) ||
    (request.headers.get('Accept') || '').includes('text/x-component')
  );
}

function mayStore(response: Response): boolean {
  const directives = (response.headers.get('Cache-Control') || '')
    .toLowerCase()
    .split(',')
    .map((value) => value.trim().split('=')[0].trim());
  return (
    response.status === 200 &&
    !response.redirected &&
    !directives.some((value) => ['private', 'no-store', 'no-cache'].includes(value)) &&
    !(response.headers.get('Vary') || '').split(',').some((value) => value.trim() === '*') &&
    !(response.headers.get('Content-Type') || '').toLowerCase().includes('text/html')
  );
}

async function cachedResource(request: Request | string, key: Request | string, store: boolean) {
  // Cache storage may fail (quota, eviction, private mode). An online success
  // must not become a synthetic 503 just because cache.match/put failed.
  const cache = await caches.open(CACHE).catch(() => undefined);
  const cached = await cache?.match(key).catch(() => undefined);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (store && cache && mayStore(response)) {
      await cache.put(key, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return new Response('Offline resource not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
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
  if (url.origin === self.location.origin && isNetworkNamespace(url.pathname)) return;
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    // Retain old local-only API behavior outside the reserved v1 namespace.
    // An exhaustive legacy allowlist is a separate migration step.
    event.respondWith(handleLocalApi(request));
    return;
  }
  // Do not send the legacy application's old API requests to its original host.
  if (/(^|\.)gotab\.cn$/.test(url.hostname) && url.pathname.startsWith('/api/')) {
    event.respondWith(handleLocalApi(request));
    return;
  }
  if (
    request.method === 'GET' &&
    /(^|\.)gotab\.cn$/.test(url.hostname) &&
    Object.hasOwn(offlineIcons, url.pathname)
  ) {
    const icon = offlineIcons[url.pathname];
    event.respondWith(cachedResource(icon, icon, false));
    return;
  }
  if (url.origin !== self.location.origin || request.method !== 'GET' || bypassCache(request)) return;
  if (request.mode === 'navigate') {
    const document = legacyDocument(url.pathname);
    if (!document) return;
    // Keep only known legacy entry documents pinned to the installed version.
    // Never cache a network navigation response (it may contain user data).
    event.respondWith(cachedResource(request, document, false));
    return;
  }
  // Directory prefixes alone are insufficient: /images and /config may later
  // also contain private or dynamic resources. Only build-listed public files
  // without query parameters are eligible for legacy cache-first handling.
  if (url.search || !coreFiles.has(url.pathname)) return;
  if (
    !/^\/(assets|icons|fonts|images|local|config)\//.test(url.pathname) &&
    !['/siteConfig.js', '/idleCallback.js', '/changeFavicon.js'].includes(url.pathname)
  )
    return;
  event.respondWith(cachedResource(request, request, true));
});
