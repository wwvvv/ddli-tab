// Unit tests for the real worker's fetch/install/activate handlers. CacheStorage,
// network and local API are test doubles; this does NOT replace browser E2E.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

let source = await readFile(new URL('../src/local/service-worker.ts', import.meta.url), 'utf8');
for (const statement of [
  "import { handleLocalApi } from './api.js';",
  "import { CORE_FILES, CACHE_VERSION } from './cache-manifest.js';",
]) {
  assert.equal(source.split(statement).length, 2, 'Update explicit worker import fixtures');
  source = source.replace(statement, '');
}
// CI uses the project's locked esbuild. The explicit native mode is for an
// offline source-only checkout on Node versions with stripTypeScriptTypes.
// Do not silently fall back if the installed project's compiler is broken.
let code;
if (process.env.DTAB_SW_TEST_TRANSFORM === 'native') {
  const { stripTypeScriptTypes } = await import('node:module');
  assert.equal(typeof stripTypeScriptTypes, 'function', 'Native mode requires Node with stripTypeScriptTypes');
  code = stripTypeScriptTypes(source);
} else {
  const { transformSync } = await import('esbuild');
  code = transformSync(source, { loader: 'ts', target: 'es2022', format: 'esm' }).code;
}
const script = new vm.Script(code, { filename: 'service-worker.js' });
const origin = 'https://dtab.example';
const currentCache = 'ddli-original-shell-test-version';
const coreFiles = [
  '/',
  '/index.html',
  '/newtab.html',
  '/popup.html',
  '/assets/core.js',
  '/images/public.png',
  '/config/default-template.json',
  '/icons/logo.svg',
  '/icons/history.svg',
  '/icons/weather.svg',
  '/icons/qq.svg',
  '/siteConfig.js',
];

function harness(options = {}) {
  const handlers = new Map();
  const calls = { local: [], fetch: [], match: [], put: [], open: [], deleted: [], added: [] };
  let claims = 0;
  let skips = 0;
  const entries = new Map();
  const keyOf = (key) => new URL(typeof key === 'string' ? key : key.url, origin).href;
  const cache = {
    async match(key) {
      calls.match.push(keyOf(key));
      if (options.matchError) throw new Error('cache unavailable');
      return entries.get(keyOf(key))?.clone();
    },
    async put(key, response) {
      calls.put.push(keyOf(key));
      if (options.putError) throw new Error('quota exceeded');
      entries.set(keyOf(key), response.clone());
    },
    async addAll(files) {
      calls.added.push([...files]);
      if (options.installError) throw new Error('precache incomplete');
    },
  };
  const self = {
    location: { origin },
    clients: { async claim() { claims++; } },
    skipWaiting() { skips++; },
    addEventListener(name, listener) {
      assert.ok(!handlers.has(name));
      handlers.set(name, listener);
    },
  };
  script.runInNewContext({
    self,
    URL,
    Request,
    Response,
    Headers,
    CORE_FILES: coreFiles,
    CACHE_VERSION: 'test-version',
    async handleLocalApi(request) {
      calls.local.push(request.url);
      return Response.json({ fixture: 'local-api' }, { headers: { 'X-DDLI-Mode': 'local' } });
    },
    caches: {
      async open(name) {
        calls.open.push(name);
        if (options.openError) throw new Error('cache storage disabled');
        return cache;
      },
      async keys() { return options.cacheNames || [currentCache]; },
      async delete(name) { calls.deleted.push(name); return true; },
    },
    async fetch(request) {
      calls.fetch.push(typeof request === 'string' ? request : request.url);
      if (options.networkError) throw new Error('offline');
      return options.network ? options.network() : new Response('network resource');
    },
  });
  return {
    calls,
    seed(key, body = 'installed resource') {
      entries.set(keyOf(key), new Response(body));
    },
    async fetch(path, init = {}, navigate = false) {
      const request = new Request(new URL(path, origin), init);
      // The browser owns navigation Requests; Node does not construct this mode.
      if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' });
      let response;
      let intercepted = false;
      handlers.get('fetch')({
        request,
        respondWith(value) {
          assert.equal(intercepted, false, 'respondWith must be called at most once');
          intercepted = true;
          response = Promise.resolve(value);
        },
      });
      return { intercepted, response: await response };
    },
    async lifecycle(name) {
      const waits = [];
      handlers.get(name)({ waitUntil(value) { waits.push(Promise.resolve(value)); } });
      await Promise.all(waits);
    },
    get claims() { return claims; },
    get skips() { return skips; },
  };
}

for (const path of [
  '/os', '/os/', '/os/store', '/api/v1', '/api/v1/missing', '/auth/callback?code=test',
  '/admin', '/media/private-image', '/_next/static/chunk.js', '/store', '/gallery',
  '/settings/account', '/app/gallery', '/apps/ai-studio', '/launch/ai-studio',
  '/%6fs/store', '/api/%761/sync',
]) {
  test(`new route bypasses legacy API and cache: ${path}`, async () => {
    const h = harness();
    h.seed('/index.html', 'legacy html');
    // Even an accidental cache entry must not serve the new namespace.
    h.seed(path, 'stale private cache');
    for (const navigate of [false, true]) {
      assert.equal((await h.fetch(path, {}, navigate)).intercepted, false);
    }
    assert.equal(h.calls.local.length, 0);
    assert.equal(h.calls.open.length, 0);
  });
}

test('new API writes also reach the network', async () => {
  const h = harness();
  assert.equal((await h.fetch('/api/v1/orders', { method: 'POST', body: '{}' })).intercepted, false);
  assert.equal(h.calls.local.length, 0);
});

test('legacy APIs stay local and v1 matching has a segment boundary', async () => {
  const h = harness();
  for (const path of ['/api/getSiteConfig', '/api/login', '/api/v10/test']) {
    const result = await h.fetch(path);
    assert.equal(result.response.headers.get('X-DDLI-Mode'), 'local');
  }
  assert.equal(h.calls.local.length, 3);
  assert.equal(h.calls.fetch.length, 0);
});

test('retired upstream API requests never escape to gotab.cn', async () => {
  const h = harness();
  for (const url of ['https://gotab.cn/api/login', 'https://api.gotab.cn/api/v1/test']) {
    assert.equal((await h.fetch(url)).response.headers.get('X-DDLI-Mode'), 'local');
  }
  assert.equal(h.calls.fetch.length, 0);
});

test('unrelated origins and lookalike hostnames are untouched', async () => {
  const h = harness();
  for (const url of ['https://example.com/api/test', 'https://gotab.cn.evil.example/api/login']) {
    assert.equal((await h.fetch(url)).intercepted, false);
  }
  assert.equal(h.calls.open.length, 0);
});

for (const path of ['/not-a-legacy-page', '/console/new', '/sibling', '/bad%path']) {
  test(`unknown navigation is not a legacy index fallback: ${path}`, async () => {
    const h = harness();
    h.seed('/index.html', 'legacy html');
    assert.equal((await h.fetch(path, {}, true)).intercepted, false);
    assert.equal(h.calls.open.length, 0);
  });
}

for (const [path, document] of [
  ['/', '/index.html'], ['/index.html', '/index.html'], ['/console', '/index.html'],
  ['/console/', '/index.html'], ['/s/example', '/index.html'],
  ['/newtab.html', '/newtab.html'], ['/popup.html', '/popup.html'],
]) {
  test(`known legacy navigation remains available offline: ${path}`, async () => {
    const h = harness({ networkError: true });
    h.seed(document, document);
    assert.equal(await (await h.fetch(path, {}, true)).response.text(), document);
    assert.equal(h.calls.fetch.length, 0);
  });
}

test('network navigation responses are never stored by the old worker', async () => {
  const h = harness();
  assert.equal(await (await h.fetch('/', {}, true)).response.text(), 'network resource');
  assert.equal(h.calls.put.length, 0);
});

test('only build-listed static files can use the legacy cache', async () => {
  const h = harness();
  for (const path of ['/images/user-private.png', '/config/session.json', '/assets/not-in-build.js']) {
    h.seed(path, 'must not be reused');
    assert.equal((await h.fetch(path)).intercepted, false);
  }
  assert.equal(h.calls.open.length, 0);
});

test('query-bearing static URLs do not use the shared cache', async () => {
  const h = harness();
  const path = '/images/public.png?access=private-test';
  h.seed(path, 'must not be reused');
  assert.equal((await h.fetch(path)).intercepted, false);
});

for (const headers of [
  { Authorization: 'Bearer fixture' }, { Range: 'bytes=0-10' }, { RSC: '1' },
  { 'Next-Router-State-Tree': 'fixture' }, { 'Next-Router-Prefetch': '1' },
  { Accept: 'text/x-component' },
]) {
  test(`sensitive/framework requests bypass shared cache: ${Object.keys(headers)[0]}`, async () => {
    const h = harness();
    h.seed('/assets/core.js', 'cached');
    h.seed('/index.html', 'legacy html');
    assert.equal((await h.fetch('/assets/core.js', { headers })).intercepted, false);
    assert.equal((await h.fetch('/', { headers })).intercepted, false);
    assert.equal(h.calls.open.length, 0);
  });
}

for (const mode of ['no-store']) {
  test(`explicit request cache mode is respected: ${mode}`, async () => {
    const h = harness();
    h.seed('/assets/core.js', 'cached');
    assert.equal((await h.fetch('/assets/core.js', { cache: mode })).intercepted, false);
  });
}

for (const mode of ['no-cache', 'reload']) {
  test(`ordinary ${mode} reloads keep the installed legacy shell available offline`, async () => {
    const h = harness({ networkError: true });
    h.seed('/assets/core.js', 'installed script');
    h.seed('/index.html', 'installed html');
    assert.equal(await (await h.fetch('/assets/core.js', { cache: mode })).response.text(), 'installed script');
    assert.equal(await (await h.fetch('/', { cache: mode }, true)).response.text(), 'installed html');
    assert.equal(h.calls.fetch.length, 0);
  });
}

test('HEAD and POST static requests are not replaced with cached GET responses', async () => {
  const h = harness();
  h.seed('/assets/core.js', 'cached');
  for (const method of ['HEAD', 'POST']) {
    assert.equal((await h.fetch('/assets/core.js', { method })).intercepted, false);
  }
});

test('known public asset cache misses can be cached; hits need no network', async () => {
  const h = harness();
  assert.equal(await (await h.fetch('/assets/core.js')).response.text(), 'network resource');
  assert.equal(await (await h.fetch('/assets/core.js')).response.text(), 'network resource');
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.put.length, 1);
});

for (const headers of [
  { 'Cache-Control': 'private, max-age=60' }, { 'Cache-Control': 'no-store' },
  { 'Cache-Control': 'public, NO-CACHE="Set-Cookie"' },
  { Vary: 'Accept-Encoding, *' }, { 'Content-Type': 'text/html; charset=utf-8' },
]) {
  test(`non-cacheable network response is returned but not stored: ${JSON.stringify(headers)}`, async () => {
    const h = harness({ network: () => new Response('network success', { headers }) });
    const result = await h.fetch('/assets/core.js');
    assert.equal(result.response.status, 200);
    assert.equal(await result.response.text(), 'network success');
    assert.equal(h.calls.put.length, 0);
  });
}

for (const status of [206, 404, 500]) {
  test(`status ${status} responses are preserved and never stored`, async () => {
    const h = harness({ network: () => new Response('upstream status', { status }) });
    assert.equal((await h.fetch('/assets/core.js')).response.status, status);
    assert.equal(h.calls.put.length, 0);
  });
}

test('redirected content is never added to the static cache', async () => {
  const h = harness({ network: () => {
    const response = new Response('redirect target');
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  } });
  assert.equal((await h.fetch('/assets/core.js')).response.status, 200);
  assert.equal(h.calls.put.length, 0);
});

for (const option of ['openError', 'matchError', 'putError']) {
  test(`cache ${option} does not discard a successful network response`, async () => {
    const h = harness({ [option]: true });
    const result = await h.fetch('/assets/core.js');
    assert.equal(result.response.status, 200);
    assert.equal(await result.response.text(), 'network resource');
  });
}

test('offline missing static resource returns explicit non-cacheable 503', async () => {
  const h = harness({ networkError: true });
  const result = await h.fetch('/assets/core.js');
  assert.equal(result.response.status, 503);
  assert.equal(result.response.headers.get('Cache-Control'), 'no-store');
});

test('upstream decorative icon aliases still work offline', async () => {
  const h = harness({ networkError: true });
  h.seed('/icons/weather.svg', 'weather fixture');
  const result = await h.fetch('https://gotab.cn/sourceStore/website/01J8J19PV7B4755AETNTX200KD.svg');
  assert.equal(await result.response.text(), 'weather fixture');
  assert.equal(h.calls.fetch.length, 0);
});

test('install precaches the exact manifest without forcing activation', async () => {
  const h = harness();
  await h.lifecycle('install');
  assert.deepEqual(h.calls.added, [coreFiles]);
  assert.equal(h.skips, 0);
});

test('failed precache rejects install instead of activating a partial shell', async () => {
  const h = harness({ installError: true });
  await assert.rejects(h.lifecycle('install'), /precache incomplete/);
  assert.equal(h.skips, 0);
});

test('activation cleans only old DTab legacy cache names', async () => {
  const h = harness({ cacheNames: [
    currentCache, 'ddli-original-shell-old', 'ddli-shell-old', 'dtab-os-future', 'other-app',
  ] });
  await h.lifecycle('activate');
  assert.deepEqual(h.calls.deleted.sort(), ['ddli-original-shell-old', 'ddli-shell-old']);
  assert.equal(h.claims, 1);
  assert.equal(h.skips, 0);
});
