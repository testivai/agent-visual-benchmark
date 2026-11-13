import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: 'functional', testMatch: 'functional.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop', testMatch: 'visual.spec.ts', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'phone', testMatch: 'visual.spec.ts', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { PORT: String(port) },
    timeout: 30_000,
  },
});
