// The runner end to end with the fake agent: real workspaces, real scoring by
// the hidden oracle. This is the check the plan asks for before any real agent:
// a reference fix scores success, a wrong fix failure, doing nothing fails a
// fix task and passes a decoy, and a crash is an error that is retried once.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executePlan, readRecords } from '../execute.mjs';
import { loadConfig } from '../config.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';

const FAKE = [process.execPath, path.join(REPO_ROOT, 'runner', 'fake-claude.mjs')];
const KEY = 'sk-ant-api03-FAKEKEY-for-tests-only-0123456789';
const oracle = (id, file) => path.join(REPO_ROOT, 'oracle', id, file);
const EMPTY = path.join(os.tmpdir(), 'avb-empty.patch');

function testConfig(over = {}) {
  const base = loadConfig(path.join(REPO_ROOT, 'runner.config.json'));
  return { ...base, isolation: 'none', concurrency: 2, agent: { ...base.agent, command: FAKE, model: 'claude-fake-1', timeLimitMinutes: 2, ...over } };
}

const context = { configHash: 'test', benchCommit: 'test', versions: { node: process.version } };
let resultsDir;
let records;
let state;

// run id -> what the fake agent does
const BEHAVIOUR = {
  'test-001': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: oracle('t01', 'reference.patch') },
  'test-002': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: oracle('t01', 'wrong.patch') },
  'test-003': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: EMPTY },
  'test-004': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: EMPTY },
  'test-005': { FAKE_CLAUDE_MODE: 'crash' },
  'test-006': { FAKE_CLAUDE_MODE: 'crash-once' },
  'test-007': { FAKE_CLAUDE_MODE: 'touch-baseline', FAKE_CLAUDE_PATCH: oracle('t01', 'reference.patch') },
  'test-008': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: oracle('t07', 'reference.patch') },
  'test-009': { FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: oracle('t07', 'wrong.patch'), FAKE_CLAUDE_STATUS: 'NOT DONE' },
  'test-010': { FAKE_CLAUDE_MODE: 'leak-key' },
};

const PLAN = {
  phase: 'test',
  seed: 1,
  runs: [
    ['t01', 'A'], ['t01', 'B'], ['t01', 'C'], ['t13', 'A'], ['t13', 'B'], ['t13', 'C'], ['t01', 'B'], ['t07', 'C'], ['t07', 'A'], ['t13', 'A'],
  ].map(([task, arm], i) => ({ runId: `test-${String(i + 1).padStart(3, '0')}`, order: i + 1, task, arm, repeat: 1 })),
};

const last = (id) => records.filter((r) => r.run_id === id).at(-1);

before(async () => {
  fs.writeFileSync(EMPTY, '');
  resultsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-results-'));
  state = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-state-'));
  records = await executePlan({
    benchRoot: REPO_ROOT,
    config: testConfig(),
    plan: PLAN,
    resultsDir,
    context: { ...context, extraEnv: { ANTHROPIC_API_KEY: KEY } },
    extraEnvFor: (run) => ({ ...BEHAVIOUR[run.runId], FAKE_CLAUDE_STATE: path.join(state, run.runId) }),
  });
}, { timeout: 30 * 60 * 1000 });

test('the reference fix scores success', () => {
  const r = last('test-001');
  assert.equal(r.error, null);
  assert.equal(r.fixed, true);
  assert.equal(r.collateral_clean, true);
  assert.equal(r.tampered, false);
  assert.equal(r.success, true);
  assert.equal(r.claimed_done, true);
  assert.equal(r.false_done, false);
  assert.equal(r.functional, 'passed');
  assert.equal(r.stop_reason, 'completed');
  assert.equal(r.site_files_changed, 1);
});

test('the wrong fix scores failure, and its claim of done is a false done', () => {
  const r = last('test-002');
  assert.equal(r.error, null);
  assert.equal(r.success, false);
  assert.equal(r.false_done, true);
});

test('doing nothing fails a fix task', () => {
  const r = last('test-003');
  assert.equal(r.error, null);
  assert.equal(r.fixed, false);
  assert.equal(r.success, false);
  assert.equal(r.site_files_changed, 0);
});

test('doing nothing passes a decoy', () => {
  const r = last('test-004');
  assert.equal(r.error, null);
  assert.equal(r.task_type, 'decoy');
  assert.equal(r.success, true);
});

test('a crash is an error, not a failure, and is retried exactly once', () => {
  const attempts = records.filter((r) => r.run_id === 'test-005');
  assert.deepEqual(attempts.map((r) => r.attempt), [1, 2]);
  for (const a of attempts) {
    assert.equal(a.error.stage, 'agent');
    assert.equal(a.success, undefined, 'an error has no outcome');
  }
});

test('a crash that does not happen again: the retry is scored, and both attempts are kept', () => {
  const attempts = records.filter((r) => r.run_id === 'test-006');
  assert.deepEqual(attempts.map((r) => r.attempt), [1, 2]);
  assert.equal(attempts[0].error.stage, 'agent');
  assert.equal(attempts[1].error, null);
  assert.equal(attempts[1].success, true, 'a decoy left alone');
});

test('editing a baseline is tampering: a failure even with the right fix, and flagged', () => {
  const r = last('test-007');
  assert.equal(r.error, null);
  assert.equal(r.fixed, true);
  assert.equal(r.tampered, true);
  assert.equal(r.success, false);
  assert.match(r.tamper_paths.join('\n'), /visual\.spec\.ts-snapshots/);
  assert.ok(r.flags.includes('update_snapshots'));
});

test('a change task: the reference in arm C succeeds with the testivai server connected; the careless edit fails', () => {
  assert.equal(last('test-008').success, true);
  const careless = last('test-009');
  assert.equal(careless.fixed, true, 'the asked-for change is made');
  assert.equal(careless.collateral_clean, false, 'and the rest of the site changed');
  assert.equal(careless.success, false);
  assert.equal(careless.claimed_done, false);
  assert.equal(careless.false_done, false, 'it did not claim to be done');
});

test('every record has the fields the analysis needs', () => {
  for (const r of records.filter((x) => !x.error)) {
    for (const field of ['phase', 'run_id', 'order', 'attempt', 'task', 'task_type', 'task_category', 'arm', 'repeat', 'model', 'versions',
      'fixed', 'collateral_clean', 'success', 'claimed_done', 'false_done', 'turns', 'tokens', 'cost_usd', 'seconds', 'stop_reason', 'flags', 'tampered']) {
      assert.ok(field in r, `${r.run_id} ${field}`);
    }
    assert.equal(r.model, 'claude-fake-1');
    assert.equal(r.model_reported, 'claude-fake-1');
    assert.equal(r.cost_usd, 0.123);
    assert.deepEqual(r.tokens, { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 });
  }
});

test('transcripts and diffs are saved per attempt, and no file holds the key', () => {
  const transcripts = fs.readdirSync(path.join(resultsDir, 'transcripts'));
  assert.equal(transcripts.length, records.length);
  assert.ok(fs.readdirSync(path.join(resultsDir, 'diffs')).includes('test-001-a1.patch'));
  assert.match(fs.readFileSync(path.join(resultsDir, 'diffs', 'test-001-a1.patch'), 'utf8'), /z-index: 1;/);
  for (const dir of ['transcripts', 'diffs']) {
    for (const f of fs.readdirSync(path.join(resultsDir, dir))) {
      assert.ok(!fs.readFileSync(path.join(resultsDir, dir, f), 'utf8').includes(KEY), `${dir}/${f}`);
    }
  }
  assert.ok(!fs.readFileSync(path.join(resultsDir, 'runs.jsonl'), 'utf8').includes(KEY));
  assert.match(fs.readFileSync(path.join(resultsDir, 'transcripts', 'test-010-a1.jsonl'), 'utf8'), /\[REDACTED\]/);
});

test('running the plan again changes nothing: finished runs are not repeated', async () => {
  const before = readRecords(path.join(resultsDir, 'runs.jsonl')).length;
  await executePlan({ benchRoot: REPO_ROOT, config: testConfig(), plan: PLAN, resultsDir, context, extraEnvFor: () => ({ FAKE_CLAUDE_MODE: 'crash' }) });
  assert.equal(readRecords(path.join(resultsDir, 'runs.jsonl')).length, before);
});

test('the time limit ends a run, which is then scored as it stands', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-results-'));
  const plan = { phase: 'test', seed: 1, runs: [{ runId: 'limit-001', order: 1, task: 't01', arm: 'A', repeat: 1 }] };
  const [r] = await executePlan({
    benchRoot: REPO_ROOT, config: testConfig({ timeLimitMinutes: 0.05 }), plan, resultsDir: dir, context, extraEnvFor: () => ({ FAKE_CLAUDE_MODE: 'hang' }),
  });
  assert.equal(r.error, null);
  assert.equal(r.stop_reason, 'time_limit');
  assert.equal(r.success, false);
  assert.equal(r.claimed_done, null);
});
