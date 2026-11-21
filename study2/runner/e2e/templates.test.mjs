// Study 2's templates for one site, built for real: packages installed,
// baselines recorded, each arm's own test run against them. Slow (minutes).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureSiteTemplate } from '../templates.mjs';
import { DRIFT_SETTINGS } from '../../drift.mjs';
import { REPO_ROOT } from '../../../harness/workspace.mjs';

const { chosen } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'study2', 'drift.json'), 'utf8'));
const DRIFT = DRIFT_SETTINGS.find((s) => s.name === chosen);
const SITE = 'bare';
let cacheRoot;
const t = {};

const files = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort() : []);
const read = (...p) => fs.readFileSync(path.join(...p));

before(async () => {
  cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-templates-'));
  const log = () => {};
  for (const arm of ['B', 'C']) {
    t[`${arm}-clean`] = await ensureSiteTemplate({ site: SITE, arm, drift: null, cacheRoot, log });
    t[`${arm}-drift`] = await ensureSiteTemplate({ site: SITE, arm, drift: DRIFT, cacheRoot, log });
  }
}, { timeout: 30 * 60 * 1000 });

after(() => fs.rmSync(cacheRoot, { recursive: true, force: true }));

test('arm B: two screenshots, one per view; clean and drifted differ', () => {
  for (const kind of ['clean', 'drift']) {
    const info = t[`B-${kind}`];
    assert.equal(info.baselineCount, 2, kind);
    assert.deepEqual(files(path.join(info.dir, 'tests', 'visual.spec.ts-snapshots')), ['home-desktop-linux.png', 'home-phone-linux.png']);
  }
  for (const f of ['home-desktop-linux.png', 'home-phone-linux.png']) {
    const snap = (kind) => read(t[`B-${kind}`].dir, 'tests', 'visual.spec.ts-snapshots', f);
    assert.ok(!snap('clean').equals(snap('drift')), f);
  }
});

test('arm C: two baselines, one per view; clean and drifted differ in pixels, not in the DOM', () => {
  for (const kind of ['clean', 'drift']) assert.equal(files(path.join(t[`C-${kind}`].dir, '.testivai', 'baselines')).length, 2, kind);
  for (const name of files(path.join(t['C-clean'].dir, '.testivai', 'baselines'))) {
    const base = (kind, file) => read(t[`C-${kind}`].dir, '.testivai', 'baselines', name, file);
    assert.ok(!base('clean', 'screenshot.png').equals(base('drift', 'screenshot.png')), `${name} screenshot`);
    assert.equal(base('clean', 'dom.html').toString(), base('drift', 'dom.html').toString(), `${name} dom`);
  }
});

test('the template records what it is, and a second call takes it from the cache', async () => {
  assert.equal(t['C-drift'].drift, DRIFT.name);
  assert.equal(t['C-clean'].drift, null);
  const again = await ensureSiteTemplate({ site: SITE, arm: 'C', drift: DRIFT, cacheRoot, log: () => { throw new Error('rebuilt'); } });
  assert.deepEqual(again, t['C-drift']);
});

test('a drift that changes nothing is refused: the arm\'s own test must flag every view', async () => {
  const nothing = { name: 'nothing', fontconfig: '<match target="font"></match>' };
  await assert.rejects(
    ensureSiteTemplate({ site: SITE, arm: 'B', drift: nothing, cacheRoot, log: () => {} }),
    /arm B's own test does not flag every view against the drifted baselines/,
  );
  assert.equal(fs.readdirSync(path.join(cacheRoot, 'templates')).filter((d) => d.includes('-nothing-')).length, 0, 'nothing is cached');
});
