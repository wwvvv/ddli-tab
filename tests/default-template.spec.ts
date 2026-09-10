import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('主动恢复默认前确认并可下载原收藏备份', async ({ page }) => {
  await page.goto('/');
  await page.locator('#card-show-component-add-card-0').click();
  await page.getByRole('textbox', { name: /卡片链接/ }).fill('https://example.com');
  await page.getByRole('textbox', { name: /卡片名称/ }).fill('恢复前收藏');
  await page.getByRole('textbox', { name: /图标地址/ }).fill('/icons/logo.svg');
  await page.getByRole('button', { name: '添加卡片', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '添加卡片', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'setting', exact: true }).click();
  await page.getByText('迁移备份', { exact: true }).click();
  const panel = page.locator('#dtab-supabase-sync');
  await expect(panel).toBeVisible();
  page.once('dialog', (d) => d.dismiss());
  await panel.getByRole('button', { name: '恢复站点默认模板', exact: true }).click();
  expect(
    await page.evaluate(async () => {
      const p = '/assets/myErrorPage-duSnGROQ.js';
      const m = await import(p);
      return m.J().appData.listData[0].children.length;
    }),
  ).toBe(5);
  page.once('dialog', (d) => d.accept());
  await panel.getByRole('button', { name: '恢复站点默认模板', exact: true }).click();
  await expect(panel.getByText(/已恢复默认模板/)).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: '下载恢复前备份', exact: true }).click();
  const data = JSON.parse(await fs.readFile((await (await downloaded).path())!, 'utf8'));
  expect(data.appData.listData[0].children.at(-1).label).toBe('恢复前收藏');
  await page.reload();
  await expect(page.getByRole('link', { name: '欢迎使用 DTab', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '恢复前收藏', exact: true })).toHaveCount(0);
});
