// The command line, with the fake agent where a real one would cost money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planFor } from './run.mjs';
import { loadConfig } from './config.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';

const CLI = path.join(REPO_ROOT, 'runner', 'run.mjs');
const config = loadConfig(path.join(REPO_ROOT, 'runner.config.json'));

function fakeSetup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-cli-'));
  const cfg = { ...config, isolation: 'none', agent: { ...config.agent, command: [process.execPath, path.join(REPO_ROOT, 'runner', 'fake-claude.mjs')], claudeCodeVersion: null, model: 'claude-fake-1' } };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  fs.writeFileSync(path.join(dir, 'BUDGET.md'), 'budget_usd: TODO\n');
  return dir;
}

function cli(dir, ...args) {
  return spawnSync(process.execPath, [CLI, ...args, '--config', path.join(dir, 'config.json'), '--results', path.join(dir, 'results'), '--budget-file', path.join(dir, 'BUDGET.md')], {
    encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: 'sk-ant-api03-FAKE-cli-test-000000', FAKE_CLAUDE_MODE: 'apply' }, timeout: 10 * 60 * 1000,
  });
}

test('the pilot is 6 tasks x 3 arms x 3 repeats = 54 runs, fixed by the seeds in the config', () => {
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase: 'pilot' });
  assert.equal(plan.runs.length, 54);
  const tasks = [...new Set(plan.runs.map((r) => r.task))];
  assert.equal(tasks.length, 6);
  const types = tasks.map((id) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tasks', id, 'task.json'), 'utf8')));
  assert.equal(types.filter((t) => t.type === 'fix').length, 4);
  assert.equal(new Set(types.filter((t) => t.type === 'fix').map((t) => t.category)).size, 2);
  assert.equal(types.filter((t) => t.type === 'change').length, 1);
  assert.equal(types.filter((t) => t.type === 'decoy').length, 1);
  assert.deepEqual(planFor({ benchRoot: REPO_ROOT, config, phase: 'pilot' }), plan);
  assert.equal(plan.seed, config.seeds.order);
});

test('the full study is all 24 tasks, 360 runs', () => {
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase: 'full' });
  assert.equal(plan.runs.length, 360);
  assert.equal(new Set(plan.runs.map((r) => r.task)).size, 24);
});

test('plan prints the run count and the tasks, and spends nothing', () => {
  const dir = fakeSetup();
  const r = cli(dir, 'plan', '--phase', 'pilot');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /54 runs/);
  assert.match(r.stdout, /seed/);
  assert.ok(!fs.existsSync(path.join(dir, 'results')));
});

test('start refuses without a dry run', () => {
  const dir = fakeSetup();
  const r = cli(dir, 'start', '--phase', 'pilot');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /planned: 54 runs/);
  assert.match(r.stdout, /dry run/);
  assert.ok(!fs.existsSync(path.join(dir, 'results', 'runs.jsonl')));
});

test('a dry run records one run apart, then start refuses until a budget is set, and when over it', { timeout: 10 * 60 * 1000 }, () => {
  const dir = fakeSetup();
  const dry = cli(dir, 'dry-run', '--phase', 'pilot');
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  const records = fs.readFileSync(path.join(dir, 'results', 'dry-run.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(records.length, 1);
  assert.equal(records[0].phase, 'dry-run');
  assert.equal(records[0].arm, 'C');
  assert.equal(records[0].cost_usd, 0.123);
  assert.match(dry.stdout, /estimate for 54 runs: \$6\.64/);
  assert.match(dry.stdout, /projected for the full study \(360 runs\): \$44\.28/);
  assert.ok(!fs.existsSync(path.join(dir, 'results', 'runs.jsonl')), 'the dry run is not one of the study\'s runs');

  const noBudget = cli(dir, 'start', '--phase', 'pilot');
  assert.equal(noBudget.status, 1);
  assert.match(noBudget.stdout, /BUDGET\.md/);

  fs.writeFileSync(path.join(dir, 'BUDGET.md'), 'budget_usd: 5\n');
  const over = cli(dir, 'start', '--phase', 'pilot');
  assert.equal(over.status, 1);
  assert.match(over.stdout, /--confirm/);
  assert.ok(!fs.existsSync(path.join(dir, 'results', 'runs.jsonl')));
});
