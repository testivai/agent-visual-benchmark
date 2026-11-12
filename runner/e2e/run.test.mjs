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
import { RESTORE_TEST } from '../outcome.mjs';
import { loadConfig, selectModel } from '../config.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';

const FAKE = [process.execPath, path.join(REPO_ROOT, 'runner', 'fake-claude.mjs')];
const KEY = 'sk-ant-api03-FAKEKEY-for-tests-only-0123456789';
const oracle = (id, file) => path.join(REPO_ROOT, 'oracle', id, file);
const EMPTY = path.join(os.tmpdir(), 'avb-empty.patch');

function testConfig(over = {}) {
  const base = loadConfig(path.join(REPO_ROOT, 'runner.config.json'));
  const fake = {
    ...base,
    isolation: 'none',
    concurrency: 2,
    agent: { ...base.agent, command: FAKE, timeLimitMinutes: 2, ...over },
    models: { fake: { model: 'claude-fake-1', provider: 'anthropic-api-key', primary: true } },
  };
  return selectModel(fake, 'fake');
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
  assert.equal(r.symptom_fixed, true);
  assert.equal(r.lenient_success, true);
  assert.deepEqual(r.score_failed_tests, []);
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

test('every failed score test is recorded by title, and decides the lenient verdict', () => {
  const r = last('test-002');
  // t01's wrong fix lifts the label clear of the card: it is still behind it, at both sizes
  assert.deepEqual([...r.score_failed_tests].sort(), [
    RESTORE_TEST,
    'the "Most popular" label is in front of its card at 1280px',
    'the "Most popular" label is in front of its card at 390px',
  ].sort());
  assert.equal(r.symptom_fixed, false);
  assert.equal(r.lenient_success, false);
});

test('doing nothing fails a fix task', () => {
  const r = last('test-003');
  assert.equal(r.error, null);
  assert.equal(r.fixed, false);
  assert.equal(r.success, false);
  assert.equal(r.symptom_fixed, false);
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
      'fixed', 'collateral_clean', 'success', 'symptom_fixed', 'lenient_success', 'score_failed_tests', 'claimed_done', 'false_done', 'turns', 'tokens', 'cost_usd', 'seconds', 'stop_reason', 'flags', 'tampered']) {
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

test('a run that starts with a tool it must not have is stopped, recorded as a startup error and retried once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-results-'));
  const plan = { phase: 'test', seed: 1, runs: [{ runId: 'startup-001', order: 1, task: 't13', arm: 'B', repeat: 1 }] };
  const records = await executePlan({
    benchRoot: REPO_ROOT, config: testConfig(), plan, resultsDir: dir, context, extraEnvFor: () => ({ FAKE_CLAUDE_MODE: 'extra-tool' }),
  });
  assert.deepEqual(records.map((r) => [r.attempt, r.error?.stage]), [[1, 'startup'], [2, 'startup']]);
  assert.match(records[0].error.message, /WebFetch/);
  assert.equal(records[0].success, undefined);
});

test('a run cut off by a usage limit waits for the reset and runs again, without spending its retry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-results-'));
  const waits = [];
  const finishedCalls = [];
  const plan = { phase: 'test', seed: 1, runs: [
    { runId: 'limit-a', order: 1, task: 't13', arm: 'A', repeat: 1 },
    { runId: 'limit-b', order: 2, task: 't13', arm: 'B', repeat: 1 },
  ] };
  // limit-a: limit, then fine. limit-b: limit, crash, crash: two real errors end it.
  const modes = { 'limit-a': ['usage-limit', 'apply'], 'limit-b': ['usage-limit', 'crash', 'crash', 'apply'] };
  const records = await executePlan({
    benchRoot: REPO_ROOT, config: { ...testConfig(), concurrency: 1 }, plan, resultsDir: dir, context,
    extraEnvFor: (run, attempt) => ({ FAKE_CLAUDE_MODE: modes[run.runId][attempt - 1], FAKE_CLAUDE_PATCH: EMPTY }),
    sleep: async (ms) => { waits.push(ms); },
    onRunFinished: (run) => { finishedCalls.push(run.runId); },
  });
  assert.deepEqual(finishedCalls, ['limit-a', 'limit-b'], 'called once per run, when it is finished');
  const a = records.filter((r) => r.run_id === 'limit-a');
  assert.deepEqual(a.map((r) => [r.attempt, r.error?.stage ?? null]), [[1, 'limit'], [2, null]]);
  assert.match(a[0].error.message, /usage limit/);
  assert.ok(a[0].error.resume_at, 'the reset time is recorded');
  assert.equal(a[1].success, true);
  const b = records.filter((r) => r.run_id === 'limit-b');
  assert.deepEqual(b.map((r) => [r.attempt, r.error?.stage ?? null]), [[1, 'limit'], [2, 'agent'], [3, 'agent']]);
  assert.equal(waits.length, 2);
  assert.ok(waits.every((ms) => ms >= 60000 && ms <= 2 * 60000), `waited until the reset plus a minute: ${waits}`);
});

test('a run whose last attempt hit a limit is not finished: running the plan again resumes it', async () => {
  const { finishedRuns } = await import('../execute.mjs');
  assert.deepEqual([...finishedRuns([
    { run_id: 'x', attempt: 1, error: { stage: 'limit' } },
    { run_id: 'y', attempt: 1, error: { stage: 'limit' } }, { run_id: 'y', attempt: 2, error: null },
    { run_id: 'z', attempt: 1, error: { stage: 'agent' } }, { run_id: 'z', attempt: 2, error: { stage: 'limit' } },
    { run_id: 'w', attempt: 1, error: { stage: 'agent' } }, { run_id: 'w', attempt: 2, error: { stage: 'limit' } }, { run_id: 'w', attempt: 3, error: { stage: 'agent' } },
  ])].sort(), ['w', 'y']);
});

test('the cost of a run on another provider comes from its prices; Claude Code\'s figure is kept apart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-results-'));
  const priced = { ...testConfig(), agent: { ...testConfig().agent, provider: 'anthropic-compatible', baseUrl: 'https://example.invalid/anthropic', authTokenEnv: 'NONE',
    pricesPerMillionUsd: { input: 0.3, cacheRead: 0.006, cacheWrite: 0.3, output: 1.2 } } };
  const plan = { phase: 'test', seed: 1, runs: [{ runId: 'cost-001', order: 1, task: 't13', arm: 'A', repeat: 1 }] };
  const [r] = await executePlan({ benchRoot: REPO_ROOT, config: priced, plan, resultsDir: dir, context, extraEnvFor: () => ({ FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: EMPTY }) });
  // the fake reports 1000 input and 200 output tokens, and $0.123 from Claude Code
  assert.ok(Math.abs(r.cost_usd - (1000 * 0.3 + 200 * 1.2) / 1e6) < 1e-12);
  assert.equal(r.cost_source, 'provider prices');
  assert.equal(r.claude_code_cost_estimate, 0.123);
});
