import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

test('真实 MV3 插件加载并通过 action 获取当前网页', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'],
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4180/');
    await expect(page.getByRole('button', { name: '账号与同步', exact: true })).toBeVisible();
    const browserCdp = await context.browser()!.newBrowserCDPSession();
    const { id } = await browserCdp.send('Extensions.loadUnpacked', {
      path: path.resolve('dist-extension'),
    });
    const { targetInfos } = await browserCdp.send('Target.getTargets', {
      filter: [{ type: 'tab' }],
    });
    const targetInfo = targetInfos.find((t) => t.url === page.url())!;
    await browserCdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    let popupId = '';
    await expect
      .poll(async () => {
        const { targetInfos } = await browserCdp.send('Target.getTargets', { filter: [{}] });
        popupId = targetInfos.find((t) => t.type === 'other')?.targetId || '';
        return popupId;
      })
      .not.toBe('');
    const { sessionId } = await browserCdp.send('Target.attachToTarget', {
      targetId: popupId,
      flatten: false,
    });
    let nextId = 0;
    const evaluate = (expression: string) =>
      new Promise<any>((resolve, reject) => {
        const requestId = ++nextId;
        const timer = setTimeout(() => {
          browserCdp.off('Target.receivedMessageFromTarget', listener);
          reject(Error('Popup evaluation timed out'));
        }, 5000);
        function listener(event: any) {
          if (event.sessionId !== sessionId) return;
          const message = JSON.parse(event.message);
          if (message.id !== requestId) return;
          clearTimeout(timer);
          browserCdp.off('Target.receivedMessageFromTarget', listener);
          if (message.error || message.result?.exceptionDetails)
            reject(Error(JSON.stringify(message)));
          else resolve(message.result.result.value);
        }
        browserCdp.on('Target.receivedMessageFromTarget', listener);
        void browserCdp
          .send('Target.sendMessageToTarget', {
            sessionId,
            message: JSON.stringify({
              id: requestId,
              method: 'Runtime.evaluate',
              params: { expression, returnByValue: true, awaitPromise: true },
            }),
          })
          .catch(reject);
      });
    await browserCdp.send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id: 9999, method: 'Runtime.runIfWaitingForDebugger' }),
    });
    await expect
      .poll(() => evaluate(`document.querySelector('#status')?.textContent`))
      .toBe('已读取当前页面，请连接 DTab。');
    expect(await evaluate('location.href')).toBe(`chrome-extension://${id}/popup.html`);
    expect(await evaluate(`document.querySelector('#url').value`)).toBe(page.url());
    expect(await evaluate(`document.querySelector('#title').value`)).toBe(await page.title());
    expect(await evaluate(`document.querySelector('#icon').value`)).toMatch(/^https?:\/\//);
    // Seed stale UI only; this checks invalidation, not a successful host grant.
    await evaluate(
      `document.querySelector('#group').innerHTML = '<option value="old">old</option>'; document.querySelector('#add').disabled = false; document.querySelector('#site').value = 'https://example.com'; document.querySelector('#site').dispatchEvent(new Event('input'));`,
    );
    expect(await evaluate(`document.querySelector('#add').disabled`)).toBe(true);
    expect(await evaluate(`document.querySelector('#group').options.length`)).toBe(0);
    expect(await evaluate(`document.querySelector('#status').textContent`)).toBe(
      '站点地址已更改，请重新连接 DTab。',
    );
  } finally {
    await context.close();
  }
});
