import { expect, test, type Page } from '@playwright/test';
import { transformSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMigrationOrigin, listenLoopback, closeTestServer } from '../../scripts/migration-origin.mjs';

const OLD_COMMIT = '5348cc44045eac03f714a8ebabc977e4e760bc28';
const OLD_WORKER_BLOB = '7dc2b6c1c52be9a559de1e16b7bc97bfbc25fa79';

async function fixture(old = false) {
  const root = path.resolve('dist-original');
  const manifestPath = path.join(root, 'local/cache-manifest.js');
  const manifest = await fs.readFile(manifestPath, 'utf8');
  const { CORE_FILES } = await import(pathToFileURL(manifestPath).href);
  const currentWorker = await fs.readFile(path.join(root, 'ddli-local-sw.js'), 'utf8');
  let oldWorker = '';
  if (old) {
    // Use actual pre-M1 code, not a hand-written simulation of old worker behavior.
    const source = execFileSync('git', ['show', `${OLD_COMMIT}:src/local/service-worker.ts`]);
    const hash = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
    expect(hash).toBe(OLD_WORKER_BLOB);
    oldWorker = transformSync(source.toString(), { loader: 'ts', target: 'es2022', format: 'esm' }).code
      .replaceAll('./api.js', './local/api.js')
      .replaceAll('./cache-manifest.js', './local/cache-manifest.js');
  }
  const state = { release: old ? 'before' : 'after', brokenPrecache: false };
  const id = randomUUID();
  const server = createMigrationOrigin({
    legacyOrigin: 'http://127.0.0.1:4182',
    nextOrigin: 'http://127.0.0.1:3102',
    publicFiles: [...CORE_FILES, '/ddli-local-sw.js', '/local/cache-manifest.js'],
    override: async (pathname: string, req: { method?: string }, res: any) => {
      if (state.brokenPrecache && pathname === '/icons/logo.svg') {
        res.writeHead(503, { 'cache-control': 'no-store' }).end();
        return true;
      }
      let body: string;
      if (pathname === '/ddli-local-sw.js') body = state.release === 'before' ? oldWorker : currentWorker;
      else if (pathname === '/local/cache-manifest.js') {
        expect(manifest).toMatch(/export const CACHE_VERSION = [^\n]+/);
        body = manifest.replace(/export const CACHE_VERSION = [^\n]+/,
          `export const CACHE_VERSION = "migration-${id}-${state.release}";`);
      } else return false;
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        'service-worker-allowed': '/',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    },
  });
  const origin = await listenLoopback(server);
  return { origin, state, close: () => closeTestServer(server) };
}

async function bootLegacy(page: Page, origin: string) {
  await page.goto(origin);
  await expect(page.getByRole('textbox', { name: '搜一搜，看一看', exact: true })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(`${origin}/ddli-local-sw.js`);
}

async function apiFromPage(page: Page, url = '/api/v1/health') {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, mode: response.headers.get('X-DDLI-Mode'), body: await response.json() };
  }, url);
}

async function writeCanaries(page: Page) {
  await page.evaluate(async () => {
    localStorage.setItem('dtab-migration-canary', 'synthetic-preserved');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dtab-migration-canary', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('checks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('checks', 'readwrite');
        tx.objectStore('checks').put('synthetic-preserved', 'marker');
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

async function readCanaries(page: Page) {
  return page.evaluate(async () => {
    const stored = localStorage.getItem('dtab-migration-canary');
    const indexed = await new Promise<unknown>((resolve, reject) => {
      const open = indexedDB.open('dtab-migration-canary', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('checks')) { db.close(); resolve(null); return; }
        const tx = db.transaction('checks');
        const get = tx.objectStore('checks').get('marker');
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
        tx.oncomplete = () => db.close();
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    return { stored, indexed };
  });
}

test('single origin serves legacy, Next, real 404 and JSON API errors without a worker', async ({ request }) => {
  const site = await fixture();
  try {
    for (const route of ['/', '/console']) {
      const response = await request.get(site.origin + route);
      expect(response.status()).toBe(200);
      expect(await response.text()).toContain('data-original-entry');
    }
    for (const route of ['/os', '/os/store', '/os/gallery', '/os/settings']) {
      const response = await request.get(site.origin + route);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain('data-original-entry');
    }
    const health = await request.get(site.origin + '/api/v1/health');
    expect(health.status()).toBe(200);
    expect((await health.json()).data.ok).toBe(true);
    for (const route of ['/api/v1', '/api/v1/not-an-endpoint']) {
      for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
        const response = await request.fetch(site.origin + route, { method });
        expect(response.status()).toBe(404);
        expect(response.headers()['content-type']).toContain('application/json');
        expect(response.headers()['cache-control']).toContain('no-store');
        expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' }, requestId: expect.any(String) });
      }
    }
    const head = await request.head(site.origin + '/api/v1/not-an-endpoint');
    expect(head.status()).toBe(404);
    expect(await head.text()).toBe('');
    const missing = await request.get(site.origin + '/not-a-real-route');
    expect(missing.status()).toBe(404);
    expect(await missing.text()).not.toContain('data-original-entry');
  } finally { await site.close(); }
});

test('legacy-controlled browser enters and refreshes OS apps without caching Next/API responses', async ({ page }) => {
  const site = await fixture();
  const brokenAssets: string[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/_next/') && response.status() >= 400)
      brokenAssets.push(new URL(response.url()).pathname);
  });
  try {
    await bootLegacy(page, site.origin);
    for (const [id, name] of [['store', '商店'], ['gallery', '相册'], ['settings', '设置']]) {
      await page.goto(`${site.origin}/os/${id}`);
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    expect((await apiFromPage(page)).body.data.ok).toBe(true);
    expect((await apiFromPage(page)).mode).toBeNull();
    expect(await page.locator('script[src^="/_next/"]').count()).toBeGreaterThan(0);
    const cached = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const key of await caches.keys()) {
        if (!key.startsWith('ddli-original-shell-')) continue;
        for (const request of await (await caches.open(key)).keys()) paths.push(new URL(request.url).pathname);
      }
      return paths.filter((path) => /^\/(os|api\/v1|_next)(\/|$)/.test(path));
    });
    expect(cached).toEqual([]);
    expect(brokenAssets).toEqual([]);
  } finally { await site.close(); }
});

test('unknown paths and API errors remain 404 under the installed worker', async ({ page }) => {
  const site = await fixture();
  try {
    await bootLegacy(page, site.origin);
    const api = await apiFromPage(page, '/api/v1/not-an-endpoint');
    expect(api.status).toBe(404);
    expect(api.mode).toBeNull();
    expect(api.body.error.code).toBe('NOT_FOUND');
    const response = await page.goto(site.origin + '/not-a-real-route');
    expect(response?.status()).toBe(404);
    expect(await page.content()).not.toContain('data-original-entry');
  } finally { await site.close(); }
});

test('actual pre-M1 worker waits for both tabs to close before upgrading; canaries survive', async ({ context }) => {
  const site = await fixture(true);
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    await bootLegacy(first, site.origin);
    await bootLegacy(second, site.origin);
    await writeCanaries(first);
    // Establish that the fixture really has the OLD behavior before upgrading.
    expect((await apiFromPage(first)).mode).toBe('local');
    const oldPage = await first.goto(site.origin + '/os/store');
    expect(oldPage?.status()).toBe(200);
    expect(await first.content()).toContain('data-original-entry');
    await bootLegacy(first, site.origin);
    site.state.release = 'after';
    const workerReady = context.waitForEvent('serviceworker', { predicate: (worker) => worker.url() === site.origin + '/ddli-local-sw.js' });
    await first.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
    const updatedWorker = await workerReady;
    await expect.poll(() => first.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.waiting))).toBe(true);
    await expect(first.locator('#dtab-update-notice')).toBeVisible();
    await first.close();
    // One remaining controlled tab must prevent activation.
    expect(await second.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.waiting))).toBe(true);
    expect((await apiFromPage(second)).mode).toBe('local');
    await second.close();
    await expect.poll(() => updatedWorker.evaluate(() => self.registration.waiting === null && self.registration.active?.state === 'activated')).toBe(true);
    const fresh = await context.newPage();
    await bootLegacy(fresh, site.origin);
    expect(await readCanaries(fresh)).toEqual({ stored: 'synthetic-preserved', indexed: 'synthetic-preserved' });
    expect((await apiFromPage(fresh)).body.data.ok).toBe(true);
    await fresh.goto(site.origin + '/os/store');
    await expect(fresh.getByRole('heading', { name: '商店', exact: true })).toBeVisible();
    await fresh.close();
  } finally { await site.close(); }
});

test('failed new precache leaves the actual old worker serving the old desktop', async ({ page }) => {
  const site = await fixture(true);
  try {
    await bootLegacy(page, site.origin);
    await writeCanaries(page);
    site.state.release = 'after';
    site.state.brokenPrecache = true;
    const state = await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration('/'))!;
      return new Promise<string>((resolve, reject) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing!;
          const observe = () => {
            if (worker.state === 'redundant' || worker.state === 'installed') resolve(worker.state);
          };
          worker.addEventListener('statechange', observe);
          observe();
        }, { once: true });
        registration.update().catch(reject);
      });
    });
    expect(state).toBe('redundant');
    expect((await apiFromPage(page)).mode).toBe('local');
    await page.reload();
    await expect(page.getByRole('textbox', { name: '搜一搜，看一看', exact: true })).toBeVisible();
    expect(await readCanaries(page)).toEqual({ stored: 'synthetic-preserved', indexed: 'synthetic-preserved' });
  } finally { await site.close(); }
});

test('offline legacy reload remains available after visiting the same-origin Next shell', async ({ page, context }) => {
  const site = await fixture();
  try {
    await bootLegacy(page, site.origin);
    await writeCanaries(page);
    await page.goto(site.origin + '/os/store');
    await expect(page.getByRole('heading', { name: '商店', exact: true })).toBeVisible();
    await bootLegacy(page, site.origin);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('textbox', { name: '搜一搜，看一看', exact: true })).toBeVisible();
    expect(await readCanaries(page)).toEqual({ stored: 'synthetic-preserved', indexed: 'synthetic-preserved' });
  } finally { await context.setOffline(false); await site.close(); }
});
