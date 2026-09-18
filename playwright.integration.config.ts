import { defineConfig } from '@playwright/test';

// No production URLs/credentials: each test composes these loopback servers on one origin.
export default defineConfig({
  testDir: './tests/integration',
  workers: 1,
  timeout: 60000,
  use: {
    channel: process.env.CI ? 'chromium' : 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node scripts/serve-original.mjs --port 4182', url: 'http://127.0.0.1:4182', reuseExistingServer: false },
    { command: 'pnpm --filter @ddli/web run start --port 3102', url: 'http://127.0.0.1:3102/api/v1/health', reuseExistingServer: false, timeout: 120000 },
  ],
});
