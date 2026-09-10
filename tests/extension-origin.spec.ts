import { test, expect } from '@playwright/test';
import { sendToPage } from '../extension/bridge.js';

test('扩展发送前拒绝已跳转到其他 origin 的目标，且不泄露事件数据', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (source) => {
    let events = 0;
    window.addEventListener('dtab:extension-request', () => events++);
    const send = (0, eval)(`(${source})`);
    try {
      await send({
        expectedOrigin: 'https://other.example',
        message: { id: 'origin-test', command: 'add', page: { url: 'https://private.example' } },
      });
      return { error: '', events };
    } catch (error) {
      return { error: (error as Error).message, events };
    }
  }, sendToPage.toString());
  expect(result).toEqual({ error: 'DTab 标签页已跳转，请重新连接', events: 0 });
});

test('扩展实际发送函数在正确 origin 读取分组并添加收藏', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '搜一搜，看一看', exact: true })).toBeVisible();
  const expectedOrigin = new URL(page.url()).origin;
  const groups: any = await page.evaluate(sendToPage, {
    expectedOrigin,
    message: { id: 'origin-groups', command: 'groups' },
  });
  expect(groups.ok).toBe(true);
  const result: any = await page.evaluate(sendToPage, {
    expectedOrigin,
    message: {
      id: 'origin-add',
      command: 'add',
      groupId: groups.groups[0].id,
      page: {
        url: 'https://example.com/origin-test',
        title: '扩展目标验证',
        icon: 'https://example.com/favicon.ico',
      },
    },
  });
  expect(result.ok).toBe(true);
  await expect(page.getByRole('link', { name: '扩展目标验证', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: '扩展目标验证', exact: true })).toBeVisible();
});
