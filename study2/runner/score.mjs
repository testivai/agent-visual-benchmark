// Scores a finished study 2 workspace (study2/PREREGISTRATION.md, section 5).
// Only site/ is measured, served by the scorer's own server, so nothing else
// the agent changed can affect the verdict. Tampering is judged apart, as in
// study 1 (runner/tamper.mjs).
// - S1 to S3: score passes when what the seed changed is back (restore);
//   collateral passes when nothing else rendered changed.
// - S4: collateral passes when no file under site/ changed; what the oracle
//   measured is recorded beside it.
// - S2: partial credit, from each mutation applied alone.
// The clean, seeded and single-mutation measurements are cached on disk.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { REPO_ROOT, hashTree } from '../../harness/workspace.mjs';
import { startStaticServer } from '../../harness/static-server.mjs';
import { captureSnapshot } from '../../oracle/lib/capture.mjs';
import { describeEntry } from '../../oracle/lib/compare.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';
import { judge, partialCredit } from '../oracle.mjs';
import { siteViews } from '../validity.mjs';
import { siteDir } from './arms.mjs';
import { seededCss } from './workspace.mjs';

export const DEFAULT_CACHE = path.join(REPO_ROOT, '.cache', 'study2', 'oracle');
// Every drawn site is one page (a test in arms.test.mjs checks it).
const VIEWS = siteViews(['index.html']);
const SHOWN = 5;

const sha = (...parts) => {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(String(p)).update('\0');
  return h.digest('hex').slice(0, 24);
};
const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

// A change to how a site is measured must not reuse old measurements.
const measurementVersion = () => sha(
  read('oracle', 'lib', 'capture.mjs'), read('oracle', 'lib', 'views.mjs'), read('node_modules', '@playwright', 'test', 'package.json'), 'study2 score 1',
);

async function measure(browser, dir) {
  const server = await startStaticServer(dir);
  try {
    return await captureSnapshot(browser, server.url, { views: VIEWS });
  } finally {
    await server.close();
  }
}

async function cached(cacheRoot, key, compute) {
  const file = path.join(cacheRoot, `${key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = await compute();
  fs.mkdirSync(cacheRoot, { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
  fs.renameSync(`${file}.tmp`, file);
  return value;
}

// The drawn site with these mutations, measured (none: the clean site).
function measuredSite({ browser, cacheRoot }, site, mutations) {
  const what = JSON.stringify(mutations.map((m) => [m.valueStart, m.valueEnd, m.from, m.to]));
  return cached(cacheRoot, sha('site', site, hashTree(siteDir(site)), what, measurementVersion()), () => withTempDir('avb-s2-measure-', async (dir) => {
    fs.cpSync(siteDir(site), dir, { recursive: true });
    const css = path.join(dir, 'css', 'styles.css');
    fs.writeFileSync(css, seededCss(fs.readFileSync(css, 'utf8'), mutations));
    return measure(browser, dir);
  }));
}

// The files under site/ the agent changed, added or removed, against the one commit.
export function siteFilesChanged(ws) {
  const out = execFileSync('git', ['-c', 'core.quotepath=off', 'status', '--porcelain', '--untracked-files=all', '--', 'site'], {
    cwd: ws, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(ws) },
  });
  return out.split('\n').filter(Boolean).map((line) => line.slice(3)).sort();
}

const passed = (problems) => (problems.length === 0 ? 'passed' : 'failed');

function verdicts(task, judged, changed) {
  if (task.mutations.length === 0) {
    return { score: 'passed', collateral: passed(changed), failures: { score: [], collateral: changed.map((f) => `changed: ${f}`).slice(0, SHOWN) } };
  }
  return {
    score: passed(judged.notRestored),
    collateral: passed(judged.collateral),
    failures: { score: judged.notRestored.slice(0, SHOWN).map(describeEntry), collateral: judged.collateral.slice(0, SHOWN).map(describeEntry) },
  };
}

async function singles(ctx, task) {
  const out = [];
  for (const m of task.mutations) out.push(await measuredSite(ctx, task.site, [m]));
  return out;
}

async function scoreWith(ctx, task, ws) {
  const clean = await measuredSite(ctx, task.site, []);
  const seeded = task.mutations.length > 0 ? await measuredSite(ctx, task.site, task.mutations) : clean;
  const actual = await measure(ctx.browser, path.join(ws, 'site'));
  const judged = judge({ clean, seeded, actual });
  const changed = siteFilesChanged(ws);
  return {
    ...verdicts(task, judged, changed),
    failedTests: { score: [] },
    measured: { notRestored: judged.notRestored.length, collateral: judged.collateral.length },
    partial: task.mutations.length > 1 ? partialCredit({ clean, singles: await singles(ctx, task), actual }) : null,
    siteFilesChanged: changed,
  };
}

// task: a generated task ({ site, stratum, mutations, ... }); ws: the finished workspace.
// A scorer that cannot reach a verdict says 'error', never 'failed'.
export async function scoreTaskWorkspace({ task, ws, cacheRoot = DEFAULT_CACHE, browser = null }) {
  const own = browser === null;
  const b = own ? await chromium.launch() : browser;
  try {
    return await scoreWith({ browser: b, cacheRoot }, task, ws);
  } catch (err) {
    return {
      score: 'error', collateral: 'error', failures: { score: [String(err.message).slice(0, 500)], collateral: [] },
      failedTests: { score: [] }, measured: null, partial: null, siteFilesChanged: [],
    };
  } finally {
    if (own) await b.close();
  }
}
