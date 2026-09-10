import { test, expect } from '@playwright/test';
test('未配置 Supabase 时明确显示提示，不开放无效登录', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '账号与同步', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'DTab 账号与同步' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('status')).toContainText('尚未配置 Supabase');
  await expect(panel.getByRole('button', { name: '登录', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(panel).toBeHidden();
});
import { build } from 'esbuild';
test('配置模式通过 Supabase SDK 发起登录并可退出（模拟服务）', async ({ page }) => {
  const output = await build({
    entryPoints: ['src/local/cloud-panel.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    define: {
      __DTAB_CLOUD__: JSON.stringify({
        url: 'https://dtab-test.supabase.co',
        publishableKey: 'sb_publishable_test_only',
      }),
    },
  });
  let signedIn = false;
  let resetRequested = false,
    passwordUpdated = false;
  let remote: any = null;
  let pushes = 0;
  await page.route('https://dtab-test.supabase.co/**', async (route) => {
    if (route.request().url().includes('/auth/v1/token')) {
      expect(route.request().postDataJSON().email).toBe('fixture@example.com');
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
    } else if (route.request().url().includes('/auth/v1/recover')) {
      resetRequested = true;
      await route.fulfill({ json: {} });
    } else if (
      route.request().url().includes('/auth/v1/user') &&
      route.request().method() === 'PUT'
    ) {
      passwordUpdated = true;
      expect(route.request().postDataJSON().password).toBe('new-fixture-password');
      await route.fulfill({
        json: { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.com' },
      });
    } else if (route.request().url().includes('/auth/v1/logout'))
      await route.fulfill({ status: 204 });
    else if (route.request().url().includes('/rest/v1/dtab_snapshots'))
      await route.fulfill({ json: remote });
    else if (route.request().url().includes('/rest/v1/rpc/dtab_push_snapshot')) {
      const request = route.request().postDataJSON();
      pushes++;
      if (request.p_base_revision !== (remote?.revision ?? 0))
        await route.fulfill({ json: { ...remote, status: 'conflict' } });
      else {
        remote = { revision: (remote?.revision ?? 0) + 1, payload: request.p_payload };
        await route.fulfill({ json: { ...remote, status: 'ok' } });
      }
    } else await route.fulfill({ status: 400, json: { message: 'Unexpected fixture request' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '账号与同步', exact: true }).waitFor();
  await page.evaluate(async (source) => {
    document.getElementById('dtab-cloud-button')?.remove();
    document.querySelector('dialog[aria-label="DTab 账号与同步"]')?.remove();
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const module = await import(url);
    module.installCloudPanel();
    URL.revokeObjectURL(url);
  }, output.outputFiles[0].text);
  await page.getByRole('button', { name: '账号与同步', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'DTab 账号与同步' });
  await panel.getByRole('textbox', { name: '邮箱', exact: true }).fill('fixture@example.com');
  await panel.getByRole('button', { name: '忘记密码', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('重置链接');
  expect(resetRequested).toBe(true);
  await panel.getByLabel('密码', { exact: true }).fill('fixture-password-only');
  await panel.getByRole('button', { name: '登录', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('已登录');
  expect(signedIn).toBe(true);
  page.on('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: '以本地数据启用同步', exact: true }).click();
  await expect(panel.getByText(/已同步 · 云端版本/)).toBeVisible();
  expect(remote.payload.appData.listData[0].children).toHaveLength(4);
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('#card-show-component-add-card-0').click();
  await page.getByRole('textbox', { name: /卡片链接/ }).fill('https://example.com');
  await page.getByRole('textbox', { name: /卡片名称/ }).fill('自动同步收藏');
  await page.getByRole('textbox', { name: /图标地址/ }).fill('/icons/logo.svg');
  await page.getByRole('button', { name: '添加卡片', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '添加卡片', exact: true })).toBeHidden();
  await expect.poll(() => remote.payload.appData.listData[0].children.length).toBe(5);
  remote.payload.appData.listData[0].children[4].label = '来自另一设备';
  remote.revision++;
  await page.getByRole('button', { name: '账号与同步', exact: true }).click();
  await panel.getByRole('button', { name: '立即同步', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const p = '/assets/myErrorPage-duSnGROQ.js';
        const m = await import(p);
        return m.O.getState().appData.listData[0].children[4].label;
      }),
    )
    .toBe('来自另一设备');
  await panel.getByRole('button', { name: '修改密码', exact: true }).click();
  await panel.getByLabel('新密码', { exact: true }).fill('new-fixture-password');
  await panel.getByLabel('确认新密码', { exact: true }).fill('mismatch-password');
  await panel.getByRole('button', { name: '保存新密码', exact: true }).click();
  await expect(panel.getByText('两次输入的密码不一致。')).toBeVisible();
  expect(passwordUpdated).toBe(false);
  await panel.getByLabel('确认新密码', { exact: true }).fill('new-fixture-password');
  await panel.getByRole('button', { name: '保存新密码', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('密码已修改');
  expect(passwordUpdated).toBe(true);
  const beforeLogout = pushes;
  await panel.getByRole('button', { name: '退出登录', exact: true }).click();
  expect(pushes).toBe(beforeLogout);
  await expect(panel.getByRole('button', { name: '登录', exact: true })).toBeVisible();
});
test('原版头像入口打开 DTab 面板而不是原后端登录', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '账号与同步', exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'user', exact: true })
    .getByRole('img', { name: 'user', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'DTab 账号与同步' })).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'DTab 账号与同步' }).getByRole('status'),
  ).toContainText('尚未配置 Supabase');
});
