import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAgentRun, runOutcome } from './outcome.mjs';

const parsed = (over = {}) => ({
  hasResult: true, subtype: 'success', isError: false, model: 'claude-opus-5-5', mcpServers: [], finalText: 'STATUS: DONE', ...over,
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

test('a different model than the one pinned is an error', () => {
  const r = classify({ model: 'claude-sonnet-5-5' }, {});
  assert.match(r.error.message, /model/);
});

test('in arm C, the testivai server must have connected; other arms have no server', () => {
  assert.equal(classify({ mcpServers: [{ name: 'testivai', status: 'connected' }] }, {}, 'C').error, null);
  assert.match(classify({ mcpServers: [{ name: 'testivai', status: 'failed' }] }, {}, 'C').error.message, /testivai/);
  assert.match(classify({ mcpServers: [] }, {}, 'C').error.message, /testivai/);
  assert.match(classify({ mcpServers: [{ name: 'testivai', status: 'connected' }] }, {}, 'B').error.message, /MCP/);
});

const outcome = (over) => runOutcome({ score: 'passed', collateral: 'passed', tampered: false, status: 'done', ...over });

test('success needs the scorer, the collateral check and no tampering', () => {
  assert.deepEqual(outcome({}), { fixed: true, collateral_clean: true, success: true, claimed_done: true, false_done: false });
  assert.equal(outcome({ score: 'failed' }).success, false);
  assert.equal(outcome({ collateral: 'failed' }).success, false);
  assert.equal(outcome({ tampered: true }).success, false);
});

test('a claim of done on a run that did not succeed is a false done', () => {
  assert.equal(outcome({ score: 'failed' }).false_done, true);
  assert.equal(outcome({ tampered: true }).false_done, true);
  assert.equal(outcome({ score: 'failed', status: 'not_done' }).false_done, false);
  assert.deepEqual(outcome({ status: null }), { fixed: true, collateral_clean: true, success: true, claimed_done: null, false_done: null });
  assert.equal(outcome({ score: 'failed', status: null }).false_done, null, 'no claim, no false claim');
});

test('a scorer that gave no verdict gives no outcome', () => {
  assert.equal(outcome({ score: 'error' }).fixed, null);
  assert.equal(outcome({ score: 'error' }).success, null);
  assert.equal(outcome({ collateral: 'error' }).success, null);
});
