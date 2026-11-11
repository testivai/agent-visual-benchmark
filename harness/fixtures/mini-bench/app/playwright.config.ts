import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { PORT: String(port) },
  },
});
