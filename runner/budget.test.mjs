import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBudget, gate, latestDryRun } from './budget.mjs';
import { parseClaudeVersion } from './preflight.mjs';

function file(text) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'avb-budget-')), 'BUDGET.md');
  fs.writeFileSync(f, text);
  return f;
}

test('the budget is read from its line; TODO or missing means not set', () => {
  assert.equal(readBudget(file('# Budget\n\nbudget_usd: 150\n')), 150);
  assert.equal(readBudget(file('budget_usd: 99.5 \n')), 99.5);
  assert.equal(readBudget(file('budget_usd: TODO\n')), null);
  assert.equal(readBudget(file('nothing here\n')), null);
  assert.equal(readBudget('/no/such/BUDGET.md'), null);
});

const dry = { cost_usd: 2, seconds: 300, config_hash: 'h1' };

test('no dry run: refuse', () => {
  const g = gate({ plannedRuns: 54, dryRun: null, budgetUsd: 500, confirm: false });
  assert.equal(g.ok, false);
  assert.match(g.lines.join('\n'), /54 runs/);
  assert.match(g.lines.join('\n'), /dry run/i);
});

test('no budget: refuse, even with --confirm', () => {
  const g = gate({ plannedRuns: 54, dryRun: dry, budgetUsd: null, confirm: true });
  assert.equal(g.ok, false);
  assert.match(g.lines.join('\n'), /BUDGET\.md/);
});

test('within budget: go, and say the estimate', () => {
  const g = gate({ plannedRuns: 54, dryRun: dry, budgetUsd: 200, confirm: false });
  assert.equal(g.ok, true);
  assert.equal(g.estimateUsd, 108);
  assert.match(g.lines.join('\n'), /\$108\.00/);
  assert.match(g.lines.join('\n'), /4\.5 hours/);
});

test('over budget: refuse unless confirmed', () => {
  assert.equal(gate({ plannedRuns: 54, dryRun: dry, budgetUsd: 100, confirm: false }).ok, false);
  assert.match(gate({ plannedRuns: 54, dryRun: dry, budgetUsd: 100, confirm: false }).lines.join('\n'), /--confirm/);
  assert.equal(gate({ plannedRuns: 54, dryRun: dry, budgetUsd: 100, confirm: true }).ok, true);
});

test('the dry run must match the current settings', () => {
  const runs = [{ ...dry, config_hash: 'old' }, { ...dry, config_hash: 'h1', cost_usd: 3 }, { ...dry, config_hash: 'h1', cost_usd: 4, error: { stage: 'agent' } }];
  assert.equal(latestDryRun(runs, 'h1').cost_usd, 3, 'the latest without an error');
  assert.equal(latestDryRun(runs, 'other'), null);
});

test('the Claude Code version is read from --version output', () => {
  assert.equal(parseClaudeVersion('2.1.322 (Claude Code)\n'), '2.1.322');
  assert.equal(parseClaudeVersion('claude 3.0.1'), '3.0.1');
  assert.equal(parseClaudeVersion('nonsense'), null);
});
