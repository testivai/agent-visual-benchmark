import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAgentRun, runOutcome, RESTORE_TEST } from './outcome.mjs';

const parsed = (over = {}) => ({
  hasResult: true, subtype: 'success', isError: false, model: 'claude-opus-5-5', tools: ['Bash', 'Edit', 'Read'], plugins: [], skills: [],
  mcpServers: [], finalText: 'STATUS: DONE', ...over,
});
const agentRes = (over = {}) => ({ exitCode: 0, timedOut: false, stderrTail: '', ...over });
const config = { agent: { model: 'claude-opus-5-5' } };
const classify = (p, a, arm = 'A') => classifyAgentRun({ parsed: parsed(p), agentRes: agentRes(a), config, arm });

test('a run that ends normally is completed, with no error', () => {
  assert.deepEqual(classify({}, {}), { stopReason: 'completed', error: null });
});

test('reaching a limit is not an error: the run is scored as it stands', () => {
  assert.deepEqual(classify({ subtype: 'error_max_turns', isError: true }, { exitCode: 1 }), { stopReason: 'max_turns', error: null });
  assert.deepEqual(classify({ subtype: 'error_max_budget_usd', isError: true }, {}), { stopReason: 'max_budget', error: null });
  assert.deepEqual(classify({ hasResult: false }, { timedOut: true, exitCode: null }), { stopReason: 'time_limit', error: null });
});

test('a crash or an error from the agent is an error, not a failure', () => {
  const crash = classify({ hasResult: false }, { exitCode: 1, stderrTail: 'boom' });
  assert.equal(crash.error.stage, 'agent');
  assert.match(crash.error.message, /without a result.*exit 1.*boom/s);
  const apiError = classify({ subtype: 'error_during_execution', isError: true }, { exitCode: 1 });
  assert.equal(apiError.error.stage, 'agent');
  const flagged = classify({ subtype: 'success', isError: true }, {});
  assert.equal(flagged.error.stage, 'agent');
});

test('a web tool in the agent\'s tool list is an error: the run would not be isolated', () => {
  assert.equal(classify({ tools: ['Bash', 'Edit', 'Read'] }, {}).error, null);
  assert.match(classify({ tools: ['Bash', 'Edit', 'Read', 'WebFetch'] }, {}).error.message, /WebFetch/);
  assert.match(classify({ tools: ['Bash', 'WebSearch'] }, {}).error.message, /WebSearch/);
});

test('a run whose transcript has no startup report is an error', () => {
  assert.match(classify({ model: null, tools: [] }, {}).error.message, /startup report/);
});

test('a different model than the one pinned is an error', () => {
  const r = classify({ model: 'claude-sonnet-5-5' }, {});
  assert.match(r.error.message, /model/);
});

test('a run stopped at startup is an error that says why', () => {
  const r = classify({ hasResult: false }, { stoppedAtStartup: ['tools that must not be there: WebFetch'], exitCode: null });
  assert.equal(r.error.stage, 'startup');
  assert.match(r.error.message, /WebFetch/);
});

test('in arm C, the testivai server must have connected; other arms have no server', () => {
  const cTools = ['Bash', 'Edit', 'Read', 'mcp__testivai__get_diff'];
  assert.equal(classify({ tools: cTools, mcpServers: [{ name: 'testivai', status: 'connected' }] }, {}, 'C').error, null);
  assert.match(classify({ tools: cTools, mcpServers: [{ name: 'testivai', status: 'failed' }] }, {}, 'C').error.message, /testivai/);
  assert.match(classify({ tools: cTools, mcpServers: [] }, {}, 'C').error.message, /testivai/);
  assert.match(classify({ mcpServers: [{ name: 'testivai', status: 'connected' }] }, {}, 'B').error.message, /MCP/);
});

const outcome = (over) => runOutcome({ score: 'passed', collateral: 'passed', tampered: false, status: 'done', ...over });

test('success needs the scorer, the collateral check and no tampering', () => {
  assert.deepEqual(outcome({}), {
    fixed: true, collateral_clean: true, success: true, symptom_fixed: true, lenient_success: true, claimed_done: true, false_done: false,
  });
  assert.equal(outcome({ score: 'failed' }).success, false);
  assert.equal(outcome({ collateral: 'failed' }).success, false);
  assert.equal(outcome({ tampered: true }).success, false);
});

test('a claim of done on a run that did not succeed is a false done', () => {
  assert.equal(outcome({ score: 'failed' }).false_done, true);
  assert.equal(outcome({ tampered: true }).false_done, true);
  assert.equal(outcome({ score: 'failed', status: 'not_done' }).false_done, false);
  assert.deepEqual(outcome({ status: null }), {
    fixed: true, collateral_clean: true, success: true, symptom_fixed: true, lenient_success: true, claimed_done: null, false_done: null,
  });
  assert.equal(outcome({ score: 'failed', status: null }).false_done, null, 'no claim, no false claim');
});

test('a scorer that gave no verdict gives no outcome', () => {
  assert.equal(outcome({ score: 'error' }).fixed, null);
  assert.equal(outcome({ score: 'error' }).success, null);
  assert.equal(outcome({ collateral: 'error' }).success, null);
});

// The lenient rate (PREREGISTRATION.md, section 8): the symptom is gone, whether or not
// the values the seed changed are back exactly as they were.
const SYMPTOM = 'the "Most popular" label is in front of its card at 1280px';

test('a fix that removes the symptom but does not restore the values is a lenient success only', () => {
  const o = outcome({ score: 'failed', scoreFailedTests: [RESTORE_TEST] });
  assert.equal(o.success, false);
  assert.equal(o.symptom_fixed, true);
  assert.equal(o.lenient_success, true);
});

test('a symptom test that fails is not a lenient success, with or without the restore test', () => {
  assert.equal(outcome({ score: 'failed', scoreFailedTests: [SYMPTOM] }).lenient_success, false);
  assert.equal(outcome({ score: 'failed', scoreFailedTests: [RESTORE_TEST, SYMPTOM] }).symptom_fixed, false);
});

test('the lenient rate still needs the collateral check and no tampering', () => {
  assert.equal(outcome({ score: 'failed', scoreFailedTests: [RESTORE_TEST], collateral: 'failed' }).lenient_success, false);
  assert.equal(outcome({ score: 'failed', scoreFailedTests: [RESTORE_TEST], tampered: true }).lenient_success, false);
  assert.equal(outcome({ tampered: true }).lenient_success, false);
});

test('a failed score with no list of failed tests gives no lenient verdict', () => {
  assert.equal(outcome({ score: 'failed' }).symptom_fixed, null);
  assert.equal(outcome({ score: 'failed', scoreFailedTests: [] }).symptom_fixed, null);
  assert.equal(outcome({ score: 'failed' }).lenient_success, null);
  assert.equal(outcome({ score: 'error', scoreFailedTests: [RESTORE_TEST] }).lenient_success, null);
});

test('every fix task has exactly one restore test, under the title the lenient rate looks for', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ids = fs.readdirSync(path.join(root, 'tasks')).filter((id) => /^t\d+$/.test(id));
  const fixes = ids.filter((id) => JSON.parse(fs.readFileSync(path.join(root, 'tasks', id, 'task.json'), 'utf8')).type === 'fix');
  assert.equal(fixes.length, 14);
  for (const id of fixes) {
    const spec = fs.readFileSync(path.join(root, 'oracle', id, 'score.spec.ts'), 'utf8');
    assert.equal(spec.split(`test('${RESTORE_TEST}'`).length - 1, 1, id);
  }
  for (const id of ids.filter((x) => !fixes.includes(x))) {
    const spec = fs.readFileSync(path.join(root, 'oracle', id, 'score.spec.ts'), 'utf8');
    assert.ok(!spec.includes(RESTORE_TEST), `${id} is not a fix task and has no restore test`);
  }
});
