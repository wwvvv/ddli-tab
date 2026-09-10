import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '搜一搜，看一看' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('initOver'))).toBe('1');
}
async function add(page: Page, title: string) {
  await page.locator('#card-show-component-add-card-0').click();
  await page.getByRole('textbox', { name: /卡片链接/ }).fill('https://example.com');
  await page.getByRole('textbox', { name: /卡片名称/ }).fill(title);
  await page.getByRole('textbox', { name: /图标地址/ }).fill('/icons/logo.svg');
  await expect(page.getByRole('button', { name: /^cloud-upload 上传$/ })).toHaveCount(0);
  await page.getByRole('button', { name: '添加卡片', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '添加卡片', exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
}
async function readState(page: Page) {
  return page.evaluate(async () => {
    // Read-only access to the original exported Redux store, not a replacement.
    const module = await import(/* @vite-ignore */ '/assets/myErrorPage-duSnGROQ.js');
    return module.O.getState();
  });
}
test('原版文件保真：除入口与配置外逐文件相同', async () => {
  const report = JSON.parse(await fs.readFile('docs/original-baseline.json', 'utf8'));
  for (const file of Object.keys(report.sha256)) {
    if (report.changedAtBuild.includes(file)) continue;
    const built = await fs.readFile(path.join('dist-original', file));
    const original = await fs.readFile(path.join('legacy/gotab/web', file));
    expect(built.equals(original), file).toBe(true);
  }
});
test('原版页面与设置保留，首次初始化不依赖原 Go 后端', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(page.getByRole('link', { name: '欢迎使用 DTab', exact: true })).toBeVisible();
  await expect(
    page.getByText('DTab · 本地数据保存在当前浏览器', { exact: true }),
  ).toBeVisible();
  expect((await readState(page)).appData.listData[0].children).toHaveLength(4);
  const response = await page.evaluate(async () => {
    const r = await fetch('/api/getDefaultData');
    return { local: r.headers.get('X-DDLI-Mode'), body: await r.json() };
  });
  expect(response.local).toBe('local');
  expect(response.body.code).toBe(200);
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  for (const name of ['主界面', '壁纸主题', '自由拖拽', '迁移备份', '分组管理'])
    await expect(page.getByRole('menuitem', { name: new RegExp(name) })).toBeVisible();
  expect(errors).toEqual([]);
});
test('通过原版编辑器添加卡片，刷新后数据仍在', async ({ page }) => {
  await ready(page);
  await add(page, '原版添加测试');
  await expect
    .poll(async () => (await readState(page)).appData.listData[0].children.length)
    .toBe(5);
  await page.reload();
  await expect(page.getByRole('link', { name: '原版添加测试', exact: true })).toBeVisible();
  expect((await readState(page)).appData.listData[0].children.at(-1).type).toBe('link');
});
test('原版主界面参数调整并持久化', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await expect(page.getByRole('slider').nth(1)).toBeVisible();
  const before = (await readState(page)).card.radius;
  await page.getByRole('slider').nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readState(page)).card.radius).toBe(before + 1);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '搜一搜，看一看' })).toBeVisible();
  expect((await readState(page)).card.radius).toBe(before + 1);
});
test('原版 JSON 导出与导入仍兼容原数据结构', async ({ page }) => {
  await ready(page);
  await add(page, '备份卡片');
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await page.getByRole('menuitem', { name: /迁移备份/ }).click();
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await page.getByRole('switch', { name: '添加 不添加' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '确定导出' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  expect(exported.appData.listData[0].children.at(-1).label).toBe('备份卡片');
  expect(exported).toHaveProperty('wallpaperTheme');
  expect(exported).not.toHaveProperty('schemaVersion');
  exported.appData.listData[0].children.at(-1).label = '从原版备份恢复';
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入', exact: true }).click();
  await (
    await chooserPromise
  ).setFiles({
    name: 'gotab-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect
    .poll(async () => (await readState(page)).appData.listData[0].children.at(-1).label)
    .toBe('从原版备份恢复');
  await page.reload();
  await expect(page.getByRole('link', { name: '从原版备份恢复', exact: true })).toBeVisible();
});
test('首次缓存完成后断网重开，原版编辑器与设置可用', async ({ page, context }) => {
  await ready(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '搜一搜，看一看' })).toBeVisible();
  await add(page, '断网收藏');
  await page.reload();
  await expect(page.getByRole('link', { name: '断网收藏', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await expect(page.getByRole('slider').first()).toBeVisible();
  await context.setOffline(false);
});
test('原版移动布局正常初始化与添加卡片', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await add(page, '移动端原版卡片');
});
