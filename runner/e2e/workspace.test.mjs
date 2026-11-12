// Real templates (npm ci, real Playwright, real baselines) and real workspaces.
// Slow: the first run installs packages and records baselines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ensureTemplate, browsersPath } from '../templates.mjs';
import { buildWorkspace, checkWorkspace } from '../workspace.mjs';
import { instructionsFor } from '../arms.mjs';
import { REPO_ROOT, diffTrees, makeWorkspace, removeWorkspace } from '../../harness/workspace.mjs';

const CACHE = path.join(REPO_ROOT, '.cache', 'runner');
const log = () => {};
const count = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).length : 0);
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(cwd) } }).trim();

test('the browsers path points at an installed Chromium', () => {
  const dir = browsersPath();
  assert.ok(fs.existsSync(dir), dir);
  assert.ok(fs.readdirSync(dir).some((d) => d.startsWith('chromium')), dir);
});

const templates = {};
for (const arm of ['A', 'B', 'C']) {
  test(`arm ${arm}: the template installs its packages and records stable baselines`, { timeout: 15 * 60 * 1000 }, async () => {
    const t = await ensureTemplate({ benchRoot: REPO_ROOT, arm, cacheRoot: CACHE, log });
    templates[arm] = t;
    assert.ok(fs.existsSync(path.join(t.dir, 'node_modules', '@playwright', 'test')));
    assert.equal(fs.existsSync(path.join(t.dir, 'node_modules', '@testivai')), arm === 'C');
    if (arm === 'B') assert.equal(count(path.join(t.dir, 'tests', 'visual.spec.ts-snapshots'), /\.png$/), 12);
    if (arm === 'C') assert.equal(fs.readdirSync(path.join(t.dir, '.testivai', 'baselines')).filter((d) => !d.startsWith('.')).length, 12);
    assert.equal(t.baselineCount, arm === 'A' ? 0 : 12);
    // a second call reuses the template
    const again = await ensureTemplate({ benchRoot: REPO_ROOT, arm, cacheRoot: CACHE, log });
    assert.equal(again.dir, t.dir);
  });
}

for (const arm of ['A', 'B', 'C']) {
  test(`arm ${arm}: a workspace is the seeded app, the arm's files, one commit and nothing else`, { timeout: 5 * 60 * 1000 }, async (t) => {
    const template = templates[arm] ?? await ensureTemplate({ benchRoot: REPO_ROOT, arm, cacheRoot: CACHE, log });
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-test-'));
    t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
    const ws = buildWorkspace({ benchRoot: REPO_ROOT, taskId: 't01', arm, templateDir: template.dir, runDir });

    // the name is fixed: nothing about the task or the arm goes into it (the
    // random part of runDir can spell anything, so it is not checked)
    assert.equal(ws, path.join(runDir, 'project'));
    assert.deepEqual(checkWorkspace(ws, { arm, benchRoot: REPO_ROOT, requireGit: true }), []);
    assert.equal(fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8'), instructionsFor(arm));

    // site/ is the clean app with the seed applied
    const seeded = makeWorkspace({ appDir: path.join(REPO_ROOT, 'app'), patches: [path.join(REPO_ROOT, 'tasks', 't01', 'seed.patch')], label: 'wscmp' });
    t.after(() => removeWorkspace(seeded));
    assert.deepEqual(diffTrees(path.join(seeded, 'site'), path.join(ws, 'site')), []);

    assert.equal(git(ws, ['rev-list', '--count', 'HEAD']), '1');
    assert.equal(git(ws, ['status', '--porcelain']), '', 'node_modules and outputs are ignored');
    assert.equal(git(ws, ['log', '-1', '--format=%s']), 'Initial commit');
    assert.ok(fs.existsSync(path.join(ws, 'node_modules', '@playwright', 'test')));
  });
}

test('in a workspace, the agent\'s own `npx playwright test` runs the functional suite and it passes', { timeout: 5 * 60 * 1000 }, async (t) => {
  const { spawnSync } = await import('node:child_process');
  const { freePort } = await import('../../harness/run-specs.mjs');
  const template = templates.A ?? await ensureTemplate({ benchRoot: REPO_ROOT, arm: 'A', cacheRoot: CACHE, log });
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-test-'));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
  const ws = buildWorkspace({ benchRoot: REPO_ROOT, taskId: 't13', arm: 'A', templateDir: template.dir, runDir });
  // the PATH has a global Playwright on some machines: the workspace's own must win
  const r = spawnSync('npx', ['playwright', 'test', 'tests/functional.spec.ts', '--reporter=line'], {
    cwd: ws, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: runDir, PORT: String(await freePort()), PLAYWRIGHT_BROWSERS_PATH: browsersPath() },
  });
  assert.equal(r.status, 0, (r.stdout + r.stderr).slice(-1500));
  assert.match(r.stdout, /16 passed/);
});

test('the final diff is the agent\'s change only, even if it deleted .gitignore', { timeout: 5 * 60 * 1000 }, async (t) => {
  const { finalDiff } = await import('../score.mjs');
  const template = templates.A ?? await ensureTemplate({ benchRoot: REPO_ROOT, arm: 'A', cacheRoot: CACHE, log });
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-test-'));
  t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
  const ws = buildWorkspace({ benchRoot: REPO_ROOT, taskId: 't01', arm: 'A', templateDir: template.dir, runDir });
  fs.rmSync(path.join(ws, '.gitignore'));
  fs.writeFileSync(path.join(ws, 'site', 'css', 'pages.css'), `${fs.readFileSync(path.join(ws, 'site', 'css', 'pages.css'), 'utf8')}\n/* x */\n`);
  fs.mkdirSync(path.join(ws, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'test-results', 'out.txt'), 'output');
  fs.writeFileSync(path.join(ws, 'node_modules', 'new.js'), 'x');
  const diff = finalDiff(ws);
  assert.deepEqual(diff.stats, { files: 2, added: 2, removed: 5 }, 'the 5 lines of .gitignore, and the 2 added to pages.css');
  assert.match(diff.text, /diff --git a\/.gitignore/);
  assert.match(diff.text, /diff --git a\/site\/css\/pages.css/);
  assert.doesNotMatch(diff.text, /^diff --git a\/(node_modules|test-results)\//m, 'no file from node_modules or the test outputs');
});

for (const arm of ['B', 'C']) {
  test(`arm ${arm}: in a seeded workspace, the agent's visual tests flag the seeded page and only it`, { timeout: 5 * 60 * 1000 }, async (t) => {
    const { spawnSync } = await import('node:child_process');
    const { freePort } = await import('../../harness/run-specs.mjs');
    const template = templates[arm] ?? await ensureTemplate({ benchRoot: REPO_ROOT, arm, cacheRoot: CACHE, log });
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-test-'));
    t.after(() => fs.rmSync(runDir, { recursive: true, force: true }));
    // t01: the "Most popular" label on the pricing page is painted behind its card
    const ws = buildWorkspace({ benchRoot: REPO_ROOT, taskId: 't01', arm, templateDir: template.dir, runDir });
    // exactly the command the instructions give (a --reporter option would replace testivai's reporter)
    const r = spawnSync('npx', ['playwright', 'test', 'tests/visual.spec.ts'], {
      cwd: ws, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: runDir, PORT: String(await freePort()), PLAYWRIGHT_BROWSERS_PATH: browsersPath() },
    });
    const output = r.stdout + r.stderr;
    if (arm === 'B') {
      assert.equal(r.status, 1, output.slice(-1500));
      assert.match(output, /2 failed/);
      assert.match(output, /\[desktop\].*pricing/);
      assert.match(output, /\[phone\].*pricing/);
      assert.ok(fs.readdirSync(path.join(ws, 'test-results')).some((d) => d.includes('pricing')), 'diff images are saved');
    } else {
      const results = JSON.parse(fs.readFileSync(path.join(ws, 'visual-report', 'results.json'), 'utf8'));
      const changed = results.snapshots.filter((s) => s.status === 'changed').map((s) => s.name).sort();
      assert.deepEqual(changed, ['pricing__desktop', 'pricing__phone'], output.slice(-1500));
      assert.equal(results.summary.passed, 10);
    }
    // running the tools writes outputs only: the workspace's protected files are unchanged
    const { tamperCheck, snapshotFiles } = await import('../tamper.mjs');
    const before = snapshotFiles(ws);
    spawnSync('npx', ['playwright', 'test', 'tests/visual.spec.ts'], {
      cwd: ws, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: runDir, PORT: String(await freePort()), PLAYWRIGHT_BROWSERS_PATH: browsersPath() },
    });
    assert.deepEqual(tamperCheck(before, snapshotFiles(ws)).tamperPaths, [], 'running the visual tests is not tampering');
  });
}
