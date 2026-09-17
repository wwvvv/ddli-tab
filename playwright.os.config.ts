import { defineConfig } from '@playwright/test';

// /os 新壳 e2e：生产构建 + 启动（Next.js 应用），与 legacy 4180 服务器隔离。
const port = Number(process.env.OS_E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/os',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL,
    channel: process.env.CI ? 'chromium' : 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.OS_E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @ddli/web run build && pnpm --filter @ddli/web run start --port ${port}`,
        url: `${baseURL}/api/v1/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 420000,
      },
});
