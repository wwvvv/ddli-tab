import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { createMigrationOrigin, selectMigrationUpstream, listenLoopback, closeTestServer } from './migration-origin.mjs';

const publicFiles = new Set(['/assets/legacy.js', '/icons/logo.svg', '/ddli-local-sw.js']);
for (const path of ['/', '/console', '/console/', '/s/fixture', '/assets/legacy.js', '/ddli-local-sw.js', '/api/getSiteConfig']) {
  test(`legacy route ${path}`, () => assert.equal(selectMigrationUpstream(path, publicFiles), 'legacy'));
}
for (const path of ['/os', '/os/store', '/api/v1', '/api/v1/health', '/api/v1/missing', '/_next/static/app.js', '/missing', '/assets/private', '/admin']) {
  test(`Next route ${path}`, () => assert.equal(selectMigrationUpstream(path, publicFiles), 'next'));
}
test('reserved namespaces cannot be shadowed by legacy public files', () => {
  for (const path of ['/os', '/os/store', '/api/v1/health', '/_next/static/app.js'])
    assert.equal(selectMigrationUpstream(path, new Set([path])), 'next');
});
test('fixture refuses non-loopback or credential-bearing upstreams', () => {
  for (const value of ['https://example.com', 'http://localhost', 'http://127.0.0.1/path', 'http://u:p@127.0.0.1'])
    assert.throws(() => createMigrationOrigin({ legacyOrigin: value, nextOrigin: 'http://127.0.0.1:3100', publicFiles }), /upstream/);
});
test('HTTP fixture preserves real upstream status, JSON, query and request body', async () => {
  const legacy = http.createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('LEGACY'));
  const next = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(404, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
    res.end(JSON.stringify({ url: req.url, body }));
  });
  const legacyOrigin = await listenLoopback(legacy);
  const nextOrigin = await listenLoopback(next);
  const proxy = createMigrationOrigin({ legacyOrigin, nextOrigin, publicFiles });
  try {
    const origin = await listenLoopback(proxy);
    const response = await fetch(`${origin}/api/v1/missing?fixture=1`, { method: 'POST', body: 'synthetic' });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-dtab-test-upstream'), 'next');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { url: '/api/v1/missing?fixture=1', body: 'synthetic' });
    assert.equal(await (await fetch(`${origin}/console`)).text(), 'LEGACY');
    assert.equal((await fetch(`${origin}/missing`)).status, 404);
  } finally {
    await closeTestServer(proxy);
    await closeTestServer(legacy);
    await closeTestServer(next);
  }
});

test('the actual missing-API handler returns unique no-store JSON errors for every method', async () => {
  const { readFile } = await import('node:fs/promises');
  // This route deliberately contains only standard ECMAScript, so no compiler substitute is needed.
  const source = await readFile(new URL('../apps/web/src/app/api/v1/[[...path]]/route.ts', import.meta.url), 'utf8');
  const route = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const ids = new Set();
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = route[method]();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.requestId, 'string');
    ids.add(body.requestId);
  }
  assert.equal(ids.size, 7);
});
