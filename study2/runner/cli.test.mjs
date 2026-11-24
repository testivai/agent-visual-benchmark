// Study 2 through the runner's command line (runner/run.mjs --study 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { STRATA, allocate } from '../generate.mjs';

const CLI = path.join(REPO_ROOT, 'runner', 'run.mjs');
const SITES = ['agency', 'bare', 'full-width-pics', 'heroic-features', 'shop-item', 'small-business'];

const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 60_000 });

function frozenSetup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-cli-'));
  const tasks = allocate(STRATA, SITES, 7).map((slot) => ({ ...slot, drift: STRATA[slot.stratum].drift, mutations: [] }));
  fs.writeFileSync(path.join(dir, 'tasks.json'), JSON.stringify({ seed: 5, tasks }));
  const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'study2', 'study.config.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'study.json'), JSON.stringify({ ...config, tasksFile: path.join(dir, 'tasks.json'), seeds: { generation: 5, pilot: 11, order: 13 } }));
  return dir;
}

test('without the seeds, study 2 has no plan', () => {
  const dir = frozenSetup();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'study.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'study.json'), JSON.stringify({ ...config, seeds: { ...config.seeds, generation: null } }));
    const r = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'pilot');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /seeds\.generation is not set: study 2's seeds are written in study2\/PREREGISTRATION\.md at the freeze/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with the seeds and the task set: the pilot is 8 tasks x 2 arms x 3 repeats, the full study 72 x 2 x 3', () => {
  const dir = frozenSetup();
  try {
    const pilot = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'pilot');
    assert.equal(pilot.status, 0, pilot.stderr);
    assert.match(pilot.stdout, /^study 2, pilot: 48 runs = 8 tasks x 2 arms x 3 repeats/m);
    assert.match(pilot.stdout, /\(chosen with seed 11\)/);
    const full = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'full');
    assert.match(full.stdout, /^study 2, full: 432 runs = 72 tasks x 2 arms x 3 repeats/m);
    const status = cli('status', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'pilot', '--results', path.join(dir, 'results'));
    assert.match(status.stdout, /pilot: 0 of 48 runs finished/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a task set generated with another seed than the one written is refused', () => {
  const dir = frozenSetup();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'study.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'study.json'), JSON.stringify({ ...config, seeds: { ...config.seeds, generation: 6 } }));
    const r = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /was generated with seed 5, not seeds\.generation \(6\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('at a higher rung, the results go to a folder of their own unless --results says otherwise', () => {
  const dir = frozenSetup();
  try {
    const tasks = JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'tasks.json'), JSON.stringify({ ...tasks, rung: 1 }));
    const r = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'pilot');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /results: .*results\/study2\/sonnet\/pilot-rung1$/m);
    assert.match(r.stdout, /pilot-r1-001/);
    const given = cli('plan', '--study', '2', '--study-config', path.join(dir, 'study.json'), '--phase', 'pilot', '--results', path.join(dir, 'mine'));
    assert.match(given.stdout, new RegExp(`results: ${path.join(dir, 'mine').replace(/[/.]/g, '\\$&')}$`, 'm'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
