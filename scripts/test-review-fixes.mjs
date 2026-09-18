// Source-level regressions. Network/CacheStorage/auth are explicit test doubles.
// CI uses the locked esbuild; native mode is only for offline source-only review.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = process.env.DTAB_REVIEW_SOURCE_ROOT || root;
let transform;
if (process.env.DTAB_REVIEW_TRANSFORM === 'native') {
  const { stripTypeScriptTypes } = await import('node:module');
  transform = (source) => stripTypeScriptTypes(source);
} else {
  const { transformSync } = await import('esbuild');
  transform = (source) => transformSync(source, { loader: 'ts', target: 'es2022', format: 'esm' }).code;
}
const read = (file) => readFile(path.join(sourceRoot, file), 'utf8');
const withoutImports = (source) => source.replace(/^import .*;\r?\n/gm, '');
const dataURL = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const workerCode = transform(withoutImports(await read('src/local/service-worker.ts')));

function worker() {
  const origin = 'https://dtab.example';
  const handlers = new Map();
  const calls = { cache: 0, local: 0 };
  const context = vm.createContext({
    URL, Response, CORE_FILES: [], CACHE_VERSION: 'regression',
    self: { location: { origin }, addEventListener: (name, fn) => handlers.set(name, fn) },
    caches: { open: async () => {
      calls.cache++;
      return { match: async (key) => ['/index.html', '/newtab.html', '/popup.html'].includes(key)
        ? new Response('LEGACY_HTML') : undefined };
    } },
    fetch: async () => new Response('network', { status: 404 }),
    handleLocalApi: async () => {
      calls.local++;
      return new Response('legacy API');
    },
  });
  new vm.Script(workerCode).runInContext(context);
  return { calls, async fetch(urlPath, mode = 'navigate') {
    let promise;
    handlers.get('fetch')({
      request: { url: new URL(urlPath, origin).href, method: 'GET', mode },
      respondWith: (response) => { promise = Promise.resolve(response); },
    });
    return promise ? await promise : null;
  } };
}
for (const route of ['/not-a-real-route', '/admin', '/auth/callback', '/media/private', '/os', '/os/store', '/api/v1', '/api/v1/health']) {
  test(`worker leaves ${route} to the network`, async () => {
    const harness = worker();
    assert.equal(await harness.fetch(route), null);
    assert.equal(harness.calls.cache, 0);
    assert.equal(harness.calls.local, 0);
  });
}
for (const route of ['/', '/index.html', '/newtab.html', '/popup.html', '/console', '/console/', '/s/example']) {
  test(`worker preserves legacy navigation ${route}`, async () => {
    const response = await worker().fetch(route);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'LEGACY_HTML');
  });
}
test('new path passthrough does not bypass blocking the original upstream', async () => {
  const harness = worker();
  await harness.fetch('https://api.gotab.cn/api/v1/example', 'cors');
  assert.equal(harness.calls.local, 1);
});

const cloud = await import(dataURL(transform(withoutImports(await read('src/local/cloud-client.ts')))));
for (const changeAtDispatch of [false, true]) {
  test(`transport binds owner across dispatch (switch=${changeAtDispatch})`, async () => {
    let account = 'A';
    let rpcCalls = 0;
    const rows = new Map();
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: account } } }, error: null }) },
      rpc: async (name, params) => {
        rpcCalls++;
        assert.equal(name, 'dtab_push_snapshot');
        assert.equal(params.p_expected_owner, 'A');
        await Promise.resolve();
        if (changeAtDispatch) account = 'B';
        // Mirrors the SQL guard BEFORE the internal writer creates any row.
        if (params.p_expected_owner !== account)
          return { data: null, error: new Error('Sync owner changed') };
        rows.set(account, structuredClone(params.p_payload));
        return { data: { status: 'ok', revision: 1, payload: params.p_payload }, error: null };
      },
    };
    const payload = { home: { privateLabel: 'A-only' } };
    const write = cloud.createSyncTransport(client, 'A').push({ id: 'fixture', baseRevision: 0, payload });
    if (changeAtDispatch) {
      await assert.rejects(write, /Sync owner changed/);
      assert.equal(rows.size, 0);
    } else {
      await write;
      assert.deepEqual(rows.get('A'), payload);
    }
    assert.equal(rows.has('B'), false);
    assert.equal(rpcCalls, 1, 'Never fall back to the unguarded RPC');
  });
}
test('a session already belonging to another account never dispatches', async () => {
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'B' } } } }) },
    rpc: () => assert.fail('RPC must not run') };
  await assert.rejects(cloud.createSyncTransport(client, 'A').push({ id: 'fixture', baseRevision: 0, payload: {} }), /账号已变化/);
});

// Test the actual Playwright config without starting a browser or server.
const settingsURL = dataURL(transform(await readFile(path.join(root, 'tests/os/server-settings.ts'), 'utf8')));
const { readOsE2eSettings } = await import(settingsURL);
const configCode = transform((await read('playwright.os.config.ts'))
  .replace("import { defineConfig } from '@playwright/test';", 'const defineConfig = (value) => value;')
  .replace("'./tests/os/server-settings'", JSON.stringify(settingsURL)));
let configCounter = 0;
async function configFor(env) {
  const names = ['OS_E2E_BASE_URL', 'LEGACY_E2E_BASE_URL', 'OS_E2E_PORT'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      delete process.env[name];
      if (env[name] !== undefined) process.env[name] = env[name];
    }
    return (await import(dataURL(configCode) + `#${configCounter++}`)).default;
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}
for (const [label, env, expectedURL, serverCount, serverURL] of [
  ['local', {}, 'http://127.0.0.1:3100', 2, 'http://127.0.0.1:4180'],
  ['external Next', { OS_E2E_BASE_URL: 'https://preview.example/' }, 'https://preview.example', 1, 'http://127.0.0.1:4180'],
  ['external legacy', { LEGACY_E2E_BASE_URL: 'https://legacy.example/' }, 'http://127.0.0.1:3100', 1, 'http://127.0.0.1:3100/api/v1/health'],
  ['both external', { OS_E2E_BASE_URL: 'https://preview.example', LEGACY_E2E_BASE_URL: 'https://legacy.example' }, 'https://preview.example', 0, null],
  ['custom port', { OS_E2E_PORT: '3200' }, 'http://127.0.0.1:3200', 2, 'http://127.0.0.1:4180'],
  ['blank external URL', { OS_E2E_BASE_URL: '  ' }, 'http://127.0.0.1:3100', 2, 'http://127.0.0.1:4180'],
]) {
  test(`Playwright uses the correct target and servers: ${label}`, async () => {
    const config = await configFor(env);
    assert.equal(config.use.baseURL, expectedURL);
    assert.equal(config.webServer.length, serverCount);
    if (serverURL) assert.equal(config.webServer[0].url, serverURL);
  });
}
test('test origins and ports reject invalid or credential-bearing input', () => {
  for (const value of ['https://user:pass@example.com', 'file:///tmp/a', 'https://example.com/path', 'https://example.com/?token=fixture', 'not a URL'])
    assert.throws(() => readOsE2eSettings({ OS_E2E_BASE_URL: value }), /HTTP\(S\) origin/);
  for (const value of ['0', '65536', 'NaN', '3.5'])
    assert.throws(() => readOsE2eSettings({ OS_E2E_PORT: value }), /OS_E2E_PORT/);
});
test('deployment runtime and package engine no longer permit the pnpm-incompatible floor', async () => {
  const edge = JSON.parse(await read('edgeone.json'));
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(edge.nodeVersion, '22.22.2');
  assert.equal(pkg.engines.node, '>=22.13.0');
  const ci = await read('.github/workflows/checks.yml');
  assert.ok(ci.includes('node@${{ steps.deployment-runtime.outputs.node }}'));
  assert.ok(ci.includes('pnpm run test:review'));
});
