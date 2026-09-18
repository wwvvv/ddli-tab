import { defineConfig } from '@playwright/test';
import { readOsE2eSettings } from './tests/os/server-settings';

// Build both outputs first. External Next and legacy origins are independent.
const settings = readOsE2eSettings();

export default defineConfig({
  testDir: './tests/os',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: settings.osBaseURL,
    channel: process.env.CI ? 'chromium' : 'msedge',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    ...(settings.startLegacy ? [{
      command: 'node scripts/serve-original.mjs --port 4180',
      url: settings.legacyBaseURL,
      reuseExistingServer: !process.env.CI,
    }] : []),
    ...(settings.startOs ? [{
      command: `pnpm --filter @ddli/web run start --port ${settings.port}`,
      url: `${settings.osBaseURL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    }] : []),
  ],
});
