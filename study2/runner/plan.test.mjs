import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotTasks, studyTwoPlan, loadStudyTwo } from './plan.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STRATA, allocate } from '../generate.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';

const SITES = ['agency', 'bare', 'full-width-pics', 'heroic-features', 'shop-item', 'small-business'];
const TASKS = allocate(STRATA, SITES, 7).map((slot) => ({ ...slot, mutations: [] }));
const CONFIG = { arms: ['B', 'C'], repeats: { pilot: 3, full: 3 }, pilot: { perStratum: 2 }, seeds: { generation: 1, pilot: 11, order: 13 } };

test('the pilot: one site drawn by the seed, then two tasks of each stratum from it, drawn by the seed', () => {
  const ids = pilotTasks(TASKS, { seed: 11, perStratum: 2 });
  const chosen = TASKS.filter((t) => ids.includes(t.id));
  assert.equal(ids.length, 8);
  assert.equal(new Set(chosen.map((t) => t.site)).size, 1, 'one site');
  for (const k of ['S1', 'S2', 'S3', 'S4']) assert.equal(chosen.filter((t) => t.stratum === k).length, 2, k);
  assert.deepEqual(pilotTasks(TASKS, { seed: 11, perStratum: 2 }), ids, 'reproducible');
  const sites = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => TASKS.find((t) => pilotTasks(TASKS, { seed, perStratum: 2 }).includes(t.id)).site));
  assert.ok(sites.size > 1, 'the seed decides the site');
});

test('the plans: the pilot\'s 8 tasks and the full 72, each for B and C, 3 repeats, in a seeded order', () => {
  const pilot = studyTwoPlan({ tasks: TASKS, config: CONFIG, phase: 'pilot' });
  assert.equal(pilot.runs.length, 8 * 2 * 3);
  assert.deepEqual([...new Set(pilot.runs.map((r) => r.arm))].sort(), ['B', 'C']);
  const full = studyTwoPlan({ tasks: TASKS, config: CONFIG, phase: 'full' });
  assert.equal(full.runs.length, 72 * 2 * 3);
  assert.equal(full.seed, 13);
  assert.match(full.runs[0].runId, /^full-001$/);
  assert.notDeepEqual(full.runs.slice(0, 6).map((r) => r.task), [...full.runs].sort((a, b) => a.task.localeCompare(b.task)).slice(0, 6).map((r) => r.task), 'shuffled');
});

test('no plan before the freeze: the seeds and the task set are written first', () => {
  assert.throws(() => studyTwoPlan({ tasks: TASKS, config: { ...CONFIG, seeds: { generation: 1, pilot: null, order: 13 } }, phase: 'pilot' }), /seeds\.pilot is not set: study 2's seeds are written in study2\/PREREGISTRATION\.md at the freeze/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-plan-'));
  try {
    const unset = path.join(dir, 'study.json');
    fs.writeFileSync(unset, JSON.stringify({ ...CONFIG, tasksFile: path.join(dir, 'tasks.json'), seeds: { ...CONFIG.seeds, generation: null } }));
    assert.throws(() => loadStudyTwo({ configFile: unset }), /seeds\.generation is not set/);
    const noTasks = path.join(dir, 'study2.json');
    fs.writeFileSync(noTasks, JSON.stringify({ ...CONFIG, tasksFile: path.join(dir, 'tasks.json') }));
    assert.throws(() => loadStudyTwo({ configFile: noTasks }), /no task set at .*tasks\.json: it is generated with seeds\.generation after the freeze/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the seeds in the config are the ones written in the frozen preregistration', () => {
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'study2', 'study.config.json'), 'utf8'));
  const text = fs.readFileSync(path.join(REPO_ROOT, 'study2', 'PREREGISTRATION.md'), 'utf8');
  const written = Object.fromEntries([...text.matchAll(/^\| `seeds\.(\w+)` \| (\d+) \|/gm)].map(([, name, value]) => [name, Number(value)]));
  assert.deepEqual(written, { generation: 2026111901, pilot: 2026111902, order: 2026111903, extension: 2026111904 });
  assert.deepEqual(config.seeds, written);
  for (const v of Object.values(config.seeds)) assert.ok(Number.isInteger(v) && v < 2 ** 32, `${v} is a 32-bit seed`);
});
