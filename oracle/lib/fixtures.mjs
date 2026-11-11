// Playwright fixtures every oracle spec uses.
//   page / baseURL  the workspace under test, served by the scorer's own static
//                   server (no code from the workspace is run)
//   oracle          the task's context and the three checks built on it
import path from 'node:path';
import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { startStaticServer } from '../../harness/static-server.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { captureSnapshot } from './capture.mjs';
import { checkRestored, checkCollateral, describeEntry } from './compare.mjs';
import { getTaskContext, sourceChanges } from './context.mjs';

// An error with this prefix means "the scorer could not run", never "the task failed".
export const INFRA_PREFIX = 'ORACLE_INFRA:';
export const infraError = (message) => new Error(`${INFRA_PREFIX} ${message}`);

const memo = new Map();
const once = (key, compute) => {
  if (!memo.has(key)) memo.set(key, compute());
  return memo.get(key);
};

const MAX_LISTED = 25;
function listed(violations) {
  const lines = violations.slice(0, MAX_LISTED).map(describeEntry);
  if (violations.length > MAX_LISTED) lines.push(`… and ${violations.length - MAX_LISTED} more`);
  return lines;
}

function makeOracle({ context, actual, benchRoot, taskId, appDir }) {
  return {
    task: context.task,
    clean: context.clean,
    scope: context.scope,
    actual,
    // Fix tasks: every field the seed changed measures as the clean app again.
    expectRestored() {
      expect(context.scope.mustRestore.size, 'the seed must change something measurable').toBeGreaterThan(0);
      expect(listed(checkRestored(context.clean, actual, context.scope)), 'what the seed changed is back as it was').toEqual([]);
    },
    // Everything the task was not allowed to change measures as the clean app.
    expectCollateralClean() {
      expect(listed(checkCollateral(context.clean, actual, context.scope)), 'the rest of the site is unchanged').toEqual([]);
    },
    // Decoys: no file under site/ differs from the seeded app.
    expectSourceUnchanged() {
      const changes = sourceChanges(benchRoot, taskId, appDir).map((c) => `${c.change}: site/${c.path}`);
      expect(changes, 'nothing was wrong, so nothing under site/ should change').toEqual([]);
    },
  };
}

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

  oracle: [async ({ browser, appDir, appServer }, use, testInfo) => {
    const taskId = path.basename(path.dirname(testInfo.file));
    const benchRoot = path.resolve(process.env.BENCH_ROOT ?? REPO_ROOT);
    let context;
    let actual;
    try {
      context = await once(`context:${benchRoot}:${taskId}`, () => getTaskContext(browser, benchRoot, taskId));
      actual = await once(`actual:${appDir}`, () => captureSnapshot(browser, appServer.url));
    } catch (err) {
      throw infraError(err.message);
    }
    await use(makeOracle({ context, actual, benchRoot, taskId, appDir }));
  }, { timeout: 10 * 60 * 1000 }],
});

export { expect };
