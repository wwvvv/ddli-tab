import { test, expect } from '@playwright/test';
test('插件桥读取分组、添加页面并去重，数据刷新后仍在', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '账号与同步', exact: true }).waitFor();
  const send = (command: string, extra: any = {}) =>
    page.evaluate(
      ({ command, extra }) =>
        new Promise<any>((resolve) => {
          const id = crypto.randomUUID();
          const listener = (event: Event) => {
            const response = JSON.parse((event as CustomEvent).detail);
            if (response.id !== id) return;
            window.removeEventListener('dtab:extension-response', listener);
            resolve(response);
          };
          window.addEventListener('dtab:extension-response', listener);
          window.dispatchEvent(
            new CustomEvent('dtab:extension-request', {
              detail: JSON.stringify({ id, command, ...extra }),
            }),
          );
        }),
      { command, extra },
    );
  const groups = await send('groups');
  expect(groups.ok).toBe(true);
  expect(groups.groups[0].label).toBe('默认');
  const input = {
    groupId: groups.groups[0].id,
    page: {
      url: 'https://example.com/plugin',
      title: '插件添加验证',
      icon: 'https://example.com/icon.png',
    },
  };
  expect((await send('add', input)).ok).toBe(true);
  await expect(page.getByRole('link', { name: '插件添加验证', exact: true })).toBeVisible();
  expect((await send('add', input)).duplicate).toBe(true);
  expect(
    (await send('add', { ...input, page: { url: 'javascript:alert(1)', title: 'bad' } })).ok,
  ).toBe(false);
  await page.reload();
  await expect(page.getByRole('link', { name: '插件添加验证', exact: true })).toBeVisible();
});
