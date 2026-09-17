import { defineConfig } from '@playwright/test';

// /os 新壳 e2e：
// - routes.spec.ts 走 Next.js 生产服务器（默认 3100，需要先 pnpm run build:web 生成 .next；
//   CI 的 verify job 在本测试前已有 build:web 步骤）；
// - legacy-sw-compat.spec.ts 走 legacy 静态服务器（4180，需要先有 dist-original 构建）。
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
  // OS_E2E_BASE_URL：外部已就绪的 Next.js 服务器（本机调试用，跳过 webServer 托管）；
  // CI 未设置该变量，由 playwright 启动 4180 legacy 服务器与 3100 next start。
  webServer: process.env.OS_E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node scripts/serve-original.mjs --port 4180',
          url: 'http://127.0.0.1:4180',
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `pnpm --filter @ddli/web run start --port ${port}`,
          url: `${baseURL}/api/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      ],
});
