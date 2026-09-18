import { expect, test } from '@playwright/test';

// M1 /os 源码壳路由验收（05-CODEX-TASKS §4）：
// 新 API 响应为预期 JSON；旧页面与新页面都能打开；404 不返回旧 HTML。
const appIds = ['store', 'gallery', 'settings'] as const;

test('GET /api/v1/health 返回预期 JSON envelope', async ({ request }) => {
  const res = await request.get('/api/v1/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.ok).toBe(true);
  expect(body.data.runtime).toBe('node');
  expect(typeof body.requestId).toBe('string');
});

test('/ 重定向到 /os 桌面', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/os$/);
});

test('/os 渲染注册表应用（商店、相册、设置）', async ({ page }) => {
  await page.goto('/os');
  await expect(page.getByRole('heading', { name: 'DTab' })).toBeVisible();
  for (const name of ['商店', '相册', '设置']) {
    await expect(page.getByRole('link', { name }).first()).toBeVisible();
  }
});

for (const appId of appIds) {
  test(`/os/${appId} 应用页可打开并返回桌面`, async ({ page }) => {
    await page.goto(`/os/${appId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回桌面' })).toBeVisible();
  });
}

test('未知应用 404 且不返回旧壳 HTML', async ({ page }) => {
  const res = await page.goto('/os/not-an-app');
  expect(res?.status()).toBe(404);
  const content = await page.content();
  expect(content).not.toContain('ddli-local-sw.js');
  expect(content).not.toContain('console');
});
