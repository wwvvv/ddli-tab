import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testIgnore: ['tests/os/**'], // /os 用例使用 playwright.os.config.ts
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4180',
    channel: process.env.CI ? 'chromium' : 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-original.mjs --port 4180',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: !process.env.CI,
  },
});
