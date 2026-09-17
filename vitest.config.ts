import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/local/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
  },
});
