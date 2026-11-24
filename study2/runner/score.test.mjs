import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { scoreTaskWorkspace, warmScorer } from './score.mjs';
import { siteDir } from './arms.mjs';
import { seededCss } from './workspace.mjs';
import { parseRules } from '../css.mjs';
import { applyMutations } from '../mutate.mjs';
import { initRepo } from '../../runner/workspace.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';
import { WORK_ROOT } from '../../harness/workspace.mjs';

const CSS = fs.readFileSync(path.join(siteDir('bare'), 'css', 'styles.css'), 'utf8');
const RULES = parseRules(CSS);
const at = (selector, property, to) => {
  const r = RULES.find((x) => x.selector === selector && x.media === null);
  const d = r.declarations.find((x) => x.property === property);
  return { ruleId: r.id, selector, media: null, property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
};
const LEAD = at('.lead', 'font-size', '1.875rem');
const MT5 = at('.mt-5', 'margin-top', '1rem !important');
// moves nothing, so its changes do not overlap the lead's
const BRAND = at('.navbar-dark', '--bs-navbar-brand-color', '#000000');

let browser;
let cacheRoot;
before(async () => {
  browser = await chromium.launch();
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  cacheRoot = fs.mkdtempSync(path.join(WORK_ROOT, 's2-score-cache-'));
});
after(async () => {
  await browser?.close();
  fs.rmSync(cacheRoot, { recursive: true, force: true });
});

// A finished workspace: the seeded site committed, then the agent's stylesheet written.
async function scoreWith(task, finalCss, dir) {
  const ws = path.join(dir, `ws-${Math.random().toString(16).slice(2)}`);
  fs.cpSync(siteDir(task.site), path.join(ws, 'site'), { recursive: true });
  const cssFile = path.join(ws, 'site', 'css', 'styles.css');
  fs.writeFileSync(cssFile, seededCss(CSS, task.mutations));
  initRepo(ws);
  if (finalCss !== null) fs.writeFileSync(cssFile, finalCss);
  return scoreTaskWorkspace({ task, ws, cacheRoot, browser });
}

const S1 = { id: 'a', stratum: 'S1', site: 'bare', drift: false, mutations: [LEAD] };

test('S1 to S3: restored and nothing else changed is a success, however the fix is written', async () => {
  await withTempDir('avb-s2-score-', async (dir) => {
    const seeded = applyMutations(CSS, S1.mutations);
    const left = await scoreWith(S1, null, dir);
    assert.deepEqual([left.score, left.collateral], ['failed', 'passed'], 'left as it was');
    assert.ok(left.failures.score.some((f) => /\.lead\[0\]\s+fontSize/.test(f)), left.failures.score.join('\n'));
    const reverted = await scoreWith(S1, CSS, dir);
    assert.deepEqual([reverted.score, reverted.collateral], ['passed', 'passed']);
    const override = await scoreWith(S1, `${seeded}\n.lead { font-size: 1.25rem; }\n`, dir);
    assert.deepEqual([override.score, override.collateral], ['passed', 'passed'], 'an override elsewhere');
    const broke = await scoreWith(S1, applyMutations(CSS, [MT5]), dir);
    assert.equal(broke.collateral, 'failed', 'fixed, but something else moved');
    assert.equal(broke.partial, null, 'partial credit is for several mutations only');
  });
});

test('S4: success is no file under the site changed; what the oracle measured is recorded beside it', async () => {
  await withTempDir('avb-s2-score-', async (dir) => {
    const decoy = { id: 'd', stratum: 'S4', site: 'bare', drift: true, mutations: [] };
    const untouched = await scoreWith(decoy, null, dir);
    assert.deepEqual([untouched.score, untouched.collateral], ['passed', 'passed']);
    assert.deepEqual(untouched.siteFilesChanged, []);
    const spaces = await scoreWith(decoy, `${CSS}\n`, dir);
    assert.deepEqual([spaces.score, spaces.collateral], ['passed', 'failed'], 'a change that measures the same still changed a file');
    assert.deepEqual(spaces.siteFilesChanged, ['site/css/styles.css']);
    assert.equal(spaces.measured.collateral, 0);
    const restyled = await scoreWith(decoy, applyMutations(CSS, [MT5]), dir);
    assert.equal(restyled.collateral, 'failed');
    assert.ok(restyled.measured.collateral > 0);
  });
});

test('S2: partial credit is the share of the mutations whose own changes are all back; changes that overlap count for neither', async () => {
  await withTempDir('avb-s2-score-', async (dir) => {
    const s2 = { id: 'b', stratum: 'S2', site: 'bare', drift: false, mutations: [LEAD, BRAND] };
    const half = await scoreWith(s2, applyMutations(CSS, [BRAND]), dir);
    assert.equal(half.score, 'failed');
    assert.deepEqual(half.partial, { restored: 1, of: 2, share: 0.5, each: [true, false] });
    const all = await scoreWith(s2, CSS, dir);
    assert.deepEqual([all.score, all.collateral], ['passed', 'passed']);
    assert.deepEqual(all.partial, { restored: 2, of: 2, share: 1, each: [true, true] });
    const overlap = { id: 'c', stratum: 'S2', site: 'bare', drift: false, mutations: [LEAD, MT5] };
    const moved = await scoreWith(overlap, applyMutations(CSS, [MT5]), dir);
    assert.deepEqual(moved.partial.each, [false, false], 'the lead is back, but the margin still moves what the lead had moved');
  });
});

test('the clean, seeded and single-mutation measurements are cached on disk', () => {
  const files = fs.readdirSync(cacheRoot).filter((f) => f.endsWith('.json'));
  // clean; [LEAD] (S1, and the single LEAD of each S2); [LEAD, BRAND]; [BRAND]; [LEAD, MT5]; [MT5]
  assert.equal(files.length, 6, files.join(', '));
});

test('the measurements a task needs can be taken before any agent runs; scoring then measures only the workspace', async () => {
  const fresh = fs.mkdtempSync(path.join(WORK_ROOT, 's2-score-warm-'));
  try {
    const s2 = { id: 'w', stratum: 'S2', site: 'bare', drift: false, mutations: [LEAD, BRAND] };
    await warmScorer({ task: s2, cacheRoot: fresh, browser });
    const before = fs.readdirSync(fresh).sort();
    assert.equal(before.length, 4, 'clean, seeded, and each mutation alone');
    await withTempDir('avb-s2-score-', async (dir) => {
      const ws = path.join(dir, 'ws');
      fs.cpSync(siteDir('bare'), path.join(ws, 'site'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'site', 'css', 'styles.css'), seededCss(CSS, s2.mutations));
      initRepo(ws);
      await scoreTaskWorkspace({ task: s2, ws, cacheRoot: fresh, browser });
    });
    assert.deepEqual(fs.readdirSync(fresh).sort(), before, 'nothing new was measured from the benchmark\'s copy of the site');
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
});
