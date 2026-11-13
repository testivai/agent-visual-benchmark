import { defineConfig } from '@playwright/test';

// The hidden scorer. Run through the harness, which sets BENCH_APP_DIR to the
// workspace to score:  npm run validate   (or harness/run-specs.mjs)
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
});
