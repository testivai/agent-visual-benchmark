import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { viewport: { width: 800, height: 600 } },
});
