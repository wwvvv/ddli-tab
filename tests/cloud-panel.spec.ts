import { build } from 'esbuild';
import { test, expect, type Page } from '@playwright/test';

async function openBackup(page: Page) {
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await page.getByText('迁移备份', { exact: true }).click();
  await expect(page.locator('#dtab-supabase-sync')).toBeVisible();
}

async function replaceSyncPanel(page: Page, cloud: { url: string; publishableKey: string }) {
  const output = await build({
    entryPoints: ['src/local/cloud-panel.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    define: { __DTAB_CLOUD__: JSON.stringify(cloud) },
  });
  await page.evaluate(async (source) => {
    (window as Window & { __dtabSyncUnmount?: () => void }).__dtabSyncUnmount?.();
    document.getElementById('dtab-supabase-sync')?.remove();
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const module = await import(url);
    module.installCloudPanel();
    URL.revokeObjectURL(url);
  }, output.outputFiles[0].text);
  await expect(page.locator('#dtab-supabase-sync')).toBeVisible();
}

test('迁移备份侧边栏在未配置 Supabase 时保留本地导入导出', async ({ page }) => {
  await page.goto('/');
  await openBackup(page);
  await replaceSyncPanel(page, { url: '', publishableKey: '' });
  const panel = page.locator('#dtab-supabase-sync');
  await expect(panel.getByRole('status')).toContainText('尚未配置 Supabase');
  await expect(panel.getByRole('button', { name: '登录并继续', exact: true })).toHaveCount(0);
  await expect(page.getByText('数据导出', { exact: true })).toBeVisible();
  await expect(page.getByText('数据导入', { exact: true })).toBeVisible();
});

test('Supabase 登录与同步嵌入迁移备份，不影响原版备份操作', async ({ page }) => {
  let signedIn = false;
  let remote: any = null;
  let pushes = 0;
  await page.route('https://dtab-test.supabase.co/**', async (route) => {
    if (route.request().url().includes('/auth/v1/token')) {
      signedIn = true;
      await route.fulfill({
        json: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            aud: 'authenticated',
            email: 'fixture@example.com',
          },
        },
      });
    } else if (route.request().url().includes('/auth/v1/logout'))
      await route.fulfill({ status: 204 });
    else if (route.request().url().includes('/rest/v1/dtab_snapshots'))
      await route.fulfill({ json: remote });
    else if (route.request().url().includes('/rest/v1/rpc/dtab_push_snapshot')) {
      const request = route.request().postDataJSON();
      pushes++;
      remote = { revision: (remote?.revision ?? 0) + 1, payload: request.p_payload };
      await route.fulfill({ json: { ...remote, status: 'ok' } });
    } else await route.fulfill({ status: 400, json: { message: 'Unexpected fixture request' } });
  });
  await page.goto('/');
  await openBackup(page);
  await replaceSyncPanel(page, {
    url: 'https://dtab-test.supabase.co',
    publishableKey: 'sb_publishable_test_only',
  });
  const panel = page.locator('#dtab-supabase-sync');
  await expect(panel.getByRole('button', { name: '登录并继续', exact: true })).toHaveClass(
    /dtab-primary/,
  );
  await panel.getByRole('textbox', { name: '邮箱', exact: true }).fill('fixture@example.com');
  await panel.getByLabel('密码', { exact: true }).fill('hidden-value');
  await panel.getByRole('button', { name: '显示', exact: true }).click();
  await expect(panel.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
  await panel.getByRole('button', { name: '隐藏', exact: true }).click();
  await panel.getByLabel('密码', { exact: true }).fill('fixture-password-only');
  await panel.getByRole('button', { name: '登录并继续', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('已登录');
  expect(signedIn).toBe(true);
  page.on('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: '以本地数据启用同步', exact: true }).click();
  await expect(panel.getByText(/已同步 · 云端版本/)).toBeVisible();
  expect(pushes).toBeGreaterThan(0);
  await expect(page.getByText('数据导出', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(panel.getByRole('button', { name: '登录并继续', exact: true })).toBeVisible();
});

test('原版头像入口跳转到迁移备份的 Supabase 同步区', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'user', exact: true })
    .getByRole('img', { name: 'user', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: /迁移备份/ })).toBeVisible();
  await expect(page.locator('#dtab-supabase-sync')).toBeVisible();
  await expect(page.getByRole('button', { name: '账号与同步', exact: true })).toHaveCount(0);
});
