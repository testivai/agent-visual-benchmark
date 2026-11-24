// Each arm's own visual test, run in a real task workspace as the agent runs
// it, must flag the task: the check validate-tasks runs on every task.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { armTestFlags } from '../arm-check.mjs';
import { ensureSiteTemplate } from '../templates.mjs';
import { siteDir } from '../arms.mjs';
import { parseRules } from '../../css.mjs';
import { DRIFT_SETTINGS } from '../../drift.mjs';
import { REPO_ROOT } from '../../../harness/workspace.mjs';

const CSS = fs.readFileSync(path.join(siteDir('bare'), 'css', 'styles.css'), 'utf8');
const RULES = parseRules(CSS);
const at = (selector, property, to) => {
  const r = RULES.find((x) => x.selector === selector && x.media === null);
  const d = r.declarations.find((x) => x.property === property);
  return { ruleId: r.id, selector, media: null, property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
};
const cacheRoot = path.join(REPO_ROOT, '.cache', 'runner');
const HINTING = DRIFT_SETTINGS[0];
const templates = {};

before(async () => {
  for (const arm of ['B', 'C']) {
    templates[`${arm}-clean`] = await ensureSiteTemplate({ site: 'bare', arm, cacheRoot, log: () => {} });
    templates[`${arm}-drift`] = await ensureSiteTemplate({ site: 'bare', arm, drift: HINTING, cacheRoot, log: () => {} });
  }
}, { timeout: 30 * 60 * 1000 });

const check = (task, arm) => armTestFlags({ task, arm, templateDir: templates[`${arm}-${task.drift ? 'drift' : 'clean'}`].dir, benchRoot: REPO_ROOT });

test('a seeded change that shows is flagged by each arm\'s own test', async () => {
  const task = { id: 'x', stratum: 'S1', site: 'bare', drift: false, mutations: [at('.lead', 'font-size', '1.875rem')] };
  for (const arm of ['B', 'C']) assert.deepEqual(await check(task, arm), { flagged: true, views: 2 }, arm);
});

test('a change that does not show is flagged by neither; a decoy against drifted baselines is flagged by both', async () => {
  const hidden = { id: 'y', stratum: 'S1', site: 'bare', drift: false, mutations: [at('.dropdown-divider', 'opacity', '0.3')] };
  for (const arm of ['B', 'C']) assert.deepEqual(await check(hidden, arm), { flagged: false, views: 0 }, arm);
  const decoy = { id: 'z', stratum: 'S4', site: 'bare', drift: true, mutations: [] };
  for (const arm of ['B', 'C']) assert.deepEqual(await check(decoy, arm), { flagged: true, views: 2 }, arm);
});

after(() => {});
