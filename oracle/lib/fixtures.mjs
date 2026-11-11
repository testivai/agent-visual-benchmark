// Playwright fixtures every oracle spec uses: the workspace under test, served
// by the scorer's own static server (no code from the workspace is run).
import path from 'node:path';
import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { startStaticServer } from '../../harness/static-server.mjs';

// An error with this prefix means "the scorer could not run", never "the task failed".
export const INFRA_PREFIX = 'ORACLE_INFRA:';
export const infraError = (message) => new Error(`${INFRA_PREFIX} ${message}`);

export const test = base.extend({
  appDir: [async ({}, use) => {
    const dir = process.env.BENCH_APP_DIR;
    if (!dir) throw infraError('BENCH_APP_DIR is not set (the directory of the workspace to score)');
    const resolved = path.resolve(dir);
    if (!fs.existsSync(path.join(resolved, 'site'))) throw infraError(`${resolved} has no site/ directory`);
    await use(resolved);
  }, { scope: 'worker' }],

  appServer: [async ({ appDir }, use) => {
    const server = await startStaticServer(path.join(appDir, 'site'));
    await use(server);
    await server.close();
  }, { scope: 'worker' }],

  baseURL: async ({ appServer }, use) => {
    await use(appServer.url);
  },
});

export { expect };
