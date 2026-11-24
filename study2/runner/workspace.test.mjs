import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildTaskWorkspace } from './workspace.mjs';
import { assembleApp, instructionsFor, siteDir, SITES } from './arms.mjs';
import { parseRules } from '../css.mjs';
import { applyMutations } from '../mutate.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';

const CSS = fs.readFileSync(path.join(siteDir('bare'), 'css', 'styles.css'), 'utf8');
const RULES = parseRules(CSS);
const at = (selector, property, to) => {
  const r = RULES.find((x) => x.selector === selector && x.media === null);
  const d = r.declarations.find((x) => x.property === property);
  return { ruleId: r.id, selector, media: null, class: 'font-size', property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
};
const TASK = { id: 's2t07', stratum: 'S3', site: 'bare', drift: true, mutations: [at('.lead', 'font-size', '1.875rem')] };

// A stand-in for a built template: the app, baselines and packages, without installing anything.
function fakeTemplate(dir, arm, site = 'bare') {
  const t = assembleApp({ site, arm, dest: path.join(dir, `template-${site}-${arm}`) });
  const base = arm === 'B' ? path.join(t, 'tests', 'visual.spec.ts-snapshots') : path.join(t, '.testivai', 'baselines', 'home-desktop');
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, arm === 'B' ? 'home-desktop-linux.png' : 'screenshot.png'), 'png');
  fs.mkdirSync(path.join(t, 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(t, 'node_modules', 'pkg', 'index.js'), '');
  fs.mkdirSync(path.join(t, 'visual-report'), { recursive: true });
  fs.writeFileSync(path.join(t, '.template.json'), '{"drift":"font-hinting-full"}');
  return t;
}

const git = (ws, args) => execFileSync('git', args, { cwd: ws, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(ws) } }).trim();

test('a task\'s workspace: the template, the mutations in the stylesheet, the instructions, one commit', async () => {
  await withTempDir('avb-s2-ws-', async (dir) => {
    for (const arm of ['B', 'C']) {
      const runDir = path.join(dir, `run-${arm}`);
      fs.mkdirSync(runDir);
      const ws = buildTaskWorkspace({ task: TASK, arm, templateDir: fakeTemplate(dir, arm), runDir, benchRoot: REPO_ROOT });
      assert.equal(ws, path.join(runDir, 'project'));
      assert.equal(fs.readFileSync(path.join(ws, 'site', 'css', 'styles.css'), 'utf8'), applyMutations(CSS, TASK.mutations));
      assert.equal(fs.readFileSync(path.join(ws, 'site', 'index.html'), 'utf8'), fs.readFileSync(path.join(siteDir('bare'), 'index.html'), 'utf8'));
      assert.equal(fs.readFileSync(path.join(ws, 'CLAUDE.md'), 'utf8'), instructionsFor(arm));
      assert.equal(git(ws, ['rev-list', '--count', 'HEAD']), '1');
      assert.equal(git(ws, ['status', '--porcelain']), '', 'everything is committed, or ignored');
      assert.ok(fs.existsSync(path.join(ws, 'node_modules', 'pkg', 'index.js')), 'packages copied after the commit');
      assert.ok(!git(ws, ['ls-files']).includes('node_modules/'), 'and not committed');
      for (const gone of ['.template.json', 'visual-report']) assert.ok(!fs.existsSync(path.join(ws, gone)), gone);
      assert.ok(git(ws, ['ls-files']).split('\n').some((f) => (arm === 'B' ? /-snapshots\//.test(f) : f.startsWith('.testivai/baselines/'))), `${arm}'s baselines are in the commit`);
    }
  });
});

test('nothing in the workspace names the task, its stratum, its drift or the study', async () => {
  await withTempDir('avb-s2-ws-', async (dir) => {
    const runDir = path.join(dir, 'run');
    fs.mkdirSync(runDir);
    const ws = buildTaskWorkspace({ task: TASK, arm: 'C', templateDir: fakeTemplate(dir, 'C'), runDir, benchRoot: REPO_ROOT });
    const tracked = git(ws, ['ls-files']).split('\n').filter((f) => /\.(md|json|ts|js|html|css)$/.test(f));
    for (const f of tracked) {
      const text = fs.readFileSync(path.join(ws, f), 'utf8');
      for (const needle of ['s2t07', 'font-hinting', 'study2', 'mutation', '"S3"']) assert.ok(!text.includes(needle), `${f} mentions ${needle}`);
    }
  });
});

test('a decoy starts from the clean site; a mutation that no longer matches the stylesheet stops the build', async () => {
  await withTempDir('avb-s2-ws-', async (dir) => {
    const decoyRun = path.join(dir, 'decoy');
    fs.mkdirSync(decoyRun);
    const ws = buildTaskWorkspace({ task: { ...TASK, stratum: 'S4', mutations: [] }, arm: 'B', templateDir: fakeTemplate(dir, 'B'), runDir: decoyRun, benchRoot: REPO_ROOT });
    assert.equal(fs.readFileSync(path.join(ws, 'site', 'css', 'styles.css'), 'utf8'), CSS);
    const staleRun = path.join(dir, 'stale');
    fs.mkdirSync(staleRun);
    const stale = { ...TASK, mutations: [{ ...TASK.mutations[0], from: '9rem' }] };
    assert.throws(
      () => buildTaskWorkspace({ task: stale, arm: 'B', templateDir: fakeTemplate(dir, 'B'), runDir: staleRun, benchRoot: REPO_ROOT }),
      /\.lead font-size is "1\.25rem" in the stylesheet, not "9rem" as recorded/,
    );
  });
});

test('every drawn site passes study 1\'s workspace checks, in both arms', async () => {
  await withTempDir('avb-s2-ws-', async (dir) => {
    for (const site of SITES) {
      for (const arm of ['B', 'C']) {
        const runDir = path.join(dir, `run-${site}-${arm}`);
        fs.mkdirSync(runDir);
        const ws = buildTaskWorkspace({ task: { id: 'x', stratum: 'S4', site, drift: true, mutations: [] }, arm, templateDir: fakeTemplate(dir, arm, site), runDir, benchRoot: REPO_ROOT });
        assert.ok(fs.existsSync(path.join(ws, 'site', 'index.html')), `${site} ${arm}`);
      }
    }
  });
});
