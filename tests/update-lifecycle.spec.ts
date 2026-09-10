import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
test('部署更新等待旧页面关闭，期间页面资源版本一致且保留用户数据', async ({ context }) => {
  let version = 'one';
  const root = path.resolve('dist-original');
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, 'http://localhost').pathname;
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let body = await fs.readFile(file);
      if (relative === 'local/cache-manifest.js')
        body = Buffer.from(
          body
            .toString()
            .replace(
              /export const CACHE_VERSION = [^\n]+/,
              `export const CACHE_VERSION = "update-test-${version}";`,
            ),
        );
      if (relative === 'index.html')
        body = Buffer.from(
          body.toString().replace('<html', `<html data-test-version="${version}"`),
        );
      const mime = relative.endsWith('.js')
        ? 'text/javascript'
        : relative.endsWith('.html')
          ? 'text/html'
          : relative.endsWith('.svg')
            ? 'image/svg+xml'
            : relative.endsWith('.css')
              ? 'text/css'
              : relative.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole('button', { name: '账号与同步', exact: true }).waitFor();
    await page.evaluate(() => localStorage.setItem('dtab-update-test', 'preserved'));
    version = 'two';
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration('/'))!.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting),
      )
      .toBe(true);
    await expect(page.locator('#dtab-update-notice')).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-test-version', 'one');
    await page.close();
    const worker = context.serviceWorkers().at(-1)!;
    await expect.poll(() => worker.evaluate(() => self.registration.waiting === null)).toBe(true);
    const fresh = await context.newPage();
    await fresh.goto(origin);
    await fresh.getByRole('button', { name: '账号与同步', exact: true }).waitFor();
    await expect(fresh.locator('html')).toHaveAttribute('data-test-version', 'two');
    expect(await fresh.evaluate(() => localStorage.getItem('dtab-update-test'))).toBe('preserved');
    await fresh.close();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
