import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { PORT: String(port) },
    timeout: 30_000,
  },
});
