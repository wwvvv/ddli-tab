import { expect, test } from '@playwright/test';

// Run against the existing legacy preview server after `npm run build`.
// These test real browser SW behavior, not a page.route() simulation.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith('/ddli-local-sw.js'),
  );
});

test('v1 API requests bypass the local API envelope', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/v1/sw-boundary-probe');
    return {
      status: response.status,
      localMode: response.headers.get('X-DDLI-Mode'),
      body: await response.json(),
    };
  });
  // The legacy preview server has no v1 backend and intentionally returns 503.
  // The old worker instead returned HTTP 200 with a legacy code:501 envelope.
  expect(result.status).toBe(503);
  expect(result.localMode).toBeNull();
  expect(result.body.code).toBe(503);
});

test('new and unknown navigations preserve the origin 404', async ({ page }) => {
  for (const path of ['/os', '/auth/callback', '/__dtab_unknown_route__']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    expect(await page.locator('body').innerText()).toContain('Not found');
  }
});

test('an unlisted image never reuses a previously cached private response', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find((value) => value.startsWith('ddli-original-shell-'));
    if (!name) throw new Error('Legacy cache was not installed');
    const cache = await caches.open(name);
    const path = '/images/__dtab_sw_boundary_probe_private__.png';
    await cache.put(path, new Response('private-canary-fixture'));
    try {
      const response = await fetch(path);
      return { status: response.status, body: await response.text() };
    } finally {
      await cache.delete(path);
    }
  });
  expect(result.status).toBe(404);
  expect(result.body).not.toContain('private-canary-fixture');
});

test('ordinary offline reload preserves the legacy entry document', async ({ page, context }) => {
  await context.setOffline(true);
  try {
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    expect(await response?.text()).toContain('data-original-entry');
  } finally {
    await context.setOffline(false);
  }
});
