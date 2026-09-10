import { test, expect } from '@playwright/test';
test('DTab branding covers defaults, icons, settings and backup names', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '欢迎使用 DTab', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/DTab/);
  await expect(page.getByRole('link', { name: '使用说明', exact: true })).toHaveAttribute(
    'href',
    /wwvvv\/ddli-tab/,
  );
  expect(await page.locator('body').innerText()).not.toMatch(/gotab|雨云|加入QQ群/i);
  const logo = await page.request.get('/icons/logo.svg');
  expect(await logo.text()).toContain('M35 29');
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await page.getByRole('menuitem', { name: /版本说明/ }).click();
  await expect(page.getByRole('heading', { name: 'DTab 版本说明' })).toBeVisible();
  await page.getByRole('menuitem', { name: /捐赠打赏/ }).click();
  await expect(page.getByText('当前未开通捐赠收款。欢迎通过项目仓库反馈问题。')).toBeVisible();
  await page.getByRole('menuitem', { name: /迁移备份/ }).click();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '确定导出' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^dtab-data-/);
});
test('旧默认卡片与标题迁移，用户卡片保留且备份原值', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '欢迎使用 DTab', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('initOver'))).toBe('1');
  const seed = await page.evaluate(async () => {
    const module = await import('/assets/myErrorPage-duSnGROQ.js');
    const state = module.O.getState().appData;
    const data = Object.fromEntries(Object.entries(state).map(([k, v]) => [k, JSON.stringify(v)]));
    const groups = JSON.parse(data.listData);
    groups[0].children[0] = {
      ...groups[0].children[0],
      label: '欢迎使用',
      link: 'https://www.gotab.cn',
      icon: 'https://www.gotab.cn/icons/logo.svg',
    };
    groups[0].children.push({ ...groups[0].children[0], id: 'custom', label: '我的 GoTab 收藏' });
    data.listData = JSON.stringify(groups);
    return JSON.stringify(data);
  });
  await page.addInitScript((value) => localStorage.setItem('persist:appData', value), seed);
  await page.reload();
  await expect(page.getByRole('link', { name: '欢迎使用 DTab', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '我的 GoTab 收藏', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('dtab:branding-backup:persist:appData')),
  ).toContain('https://www.gotab.cn');
});
