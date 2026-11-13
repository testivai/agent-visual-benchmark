// End to end: the validation harness against a tiny bench whose tasks are
// broken in known ways. Real Playwright runs, so this is the slow test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateBench, loadTasks } from './validate.mjs';
import { WORK_ROOT } from './workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MINI = path.join(HERE, 'fixtures', 'mini-bench');
const CLI = path.join(HERE, 'validate.mjs');

const workDirs = () => (fs.existsSync(WORK_ROOT) ? fs.readdirSync(WORK_ROOT).filter((d) => d.startsWith('validate-')) : []);

test('loadTasks reads every task with its files', () => {
  const tasks = loadTasks(MINI);
  assert.deepEqual(tasks.map((t) => t.id), ['bad-reference', 'cannot-fail', 'good', 'good-decoy', 'lint-bad', 'weak-wrong']);
  const good = tasks.find((t) => t.id === 'good');
  assert.equal(good.task.type, 'fix');
  assert.deepEqual(good.taskFiles, ['seed.patch', 'task.json']);
  assert.ok(good.oracleFiles.includes('score.spec.ts'));
  assert.match(good.seedPatch, /rgb\(255, 0, 0\)/);
});

test('validateBench passes good tasks and names what is wrong with each bad one', async () => {
  const before = workDirs();
  const result = await validateBench({ benchRoot: MINI, jobs: 3 });
  const by = Object.fromEntries(result.tasks.map((t) => [t.id, t]));

  assert.equal(result.ok, false);
  assert.deepEqual(result.setProblems, []);

  assert.deepEqual(by.good.problems, []);
  assert.deepEqual(by.good.outcomes.seed, { score: 'failed', collateral: 'passed', functional: 'passed' });
  assert.deepEqual(by.good.outcomes.reference, { score: 'passed', collateral: 'passed', functional: 'passed' });
  assert.deepEqual(by.good.outcomes.wrong, { score: 'failed', collateral: 'passed' });

  assert.deepEqual(by['good-decoy'].problems, []);
  assert.deepEqual(by['good-decoy'].outcomes.wrong, { score: 'passed', collateral: 'failed' });

  assert.match(by['cannot-fail'].problems.join('\n'), /seed: score must fail, but it passed/);
  assert.match(by['bad-reference'].problems.join('\n'), /reference: score must pass, but it failed/);
  assert.match(by['weak-wrong'].problems.join('\n'), /wrong: at least one of score and collateral must fail/);
  assert.match(by['lint-bad'].problems.join('\n'), /prompt: the prompt contains a class selector/);
  assert.equal(by['lint-bad'].problems.length, 1, 'lint-bad is fine apart from its prompt');

  assert.deepEqual(workDirs(), before, 'validate removes the workspaces it creates');
});

test('validateBench can be limited to some tasks', async () => {
  const result = await validateBench({ benchRoot: MINI, only: ['good', 'good-decoy'], jobs: 2 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.tasks.map((t) => t.id), ['good', 'good-decoy']);
});

test('an unknown task id is refused', async () => {
  await assert.rejects(() => validateBench({ benchRoot: MINI, only: ['nope'] }), /unknown task/i);
});

test('the command exits 0 when every task behaves and 1 when one does not', () => {
  const run = (...args) => spawnSync(process.execPath, [CLI, '--root', MINI, ...args], { encoding: 'utf8' });
  const good = run('--task', 'good,good-decoy');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /2 of 2 tasks valid/);

  const bad = run('--task', 'good,cannot-fail');
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /cannot-fail/);
  assert.match(bad.stdout, /seed: score must fail/);
  assert.match(bad.stdout, /1 of 2 tasks valid/);

  assert.equal(run('--task', 'nope').status, 2);
});
