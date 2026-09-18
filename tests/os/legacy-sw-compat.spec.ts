import { expect, test, type Page } from '@playwright/test';
import { readOsE2eSettings } from './server-settings';

// M1 允许列表兼容验收（05-CODEX-TASKS §4：旧 SW 已安装用户的升级路径与路径隔离）。
// legacy 4180 静态服务器由 playwright.os.config.ts 的 webServer 数组提供，
// dist-original 必须是包含允许列表改造的最新构建（CI 中 build 步骤先于本测试）。
const LEGACY_ORIGIN = readOsE2eSettings().legacyBaseURL;

async function waitForActiveController(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) return resolve();
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
        once: true,
      });
    });
  });
}

test.describe('旧 SW 与新路由的兼容（M1 允许列表）', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(LEGACY_ORIGIN);
    await waitForActiveController(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('/api/v1/* 由网络直连响应，不被本地 API 接管', async () => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/v1/health');
      return { status: res.status, mode: res.headers.get('X-DDLI-Mode') };
    });
    // serve-original 对 /api/* 返回 503 JSON；若被旧 SW 接管则会是
    // handleLocalApi 的 501 + X-DDLI-Mode: local envelope。
    expect(result.status).toBe(503);
    expect(result.mode).toBeNull();
  });

  test('/os/* 导航 passthrough，不被旧壳 HTML 吞掉', async () => {
    const res = await page.goto(`${LEGACY_ORIGIN}/os/store`);
    // serve-original 没有 /os 路由 → 404；改造前这里会返回 200 的旧壳 index.html。
    expect(res?.status()).toBe(404);
    const content = await page.content();
    expect(content).not.toContain('搜一搜');
  });

  test('未知导航不再被旧首页兜底', async () => {
    const res = await page.goto(`${LEGACY_ORIGIN}/not-a-real-route`);
    expect(res?.status()).toBe(404);
    expect(await page.content()).not.toContain('data-original-entry');
  });

  test('旧入口 /console 导航仍由旧壳接管', async () => {
    const res = await page.goto(`${LEGACY_ORIGIN}/console`);
    // /console 是原版 SPA 的控制台页面：由缓存/网络的 index.html 兜底后渲染，
    // title 为「控制台」；若被 404 或新壳吞掉则此断言失败。
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/控制台/, { timeout: 20000 });
  });
});
