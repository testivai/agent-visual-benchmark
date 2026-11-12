import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupProblems } from './startup.mjs';

const TESTIVAI = ['mcp__testivai__get_visual_results', 'mcp__testivai__get_diff', 'mcp__testivai__explain_snapshot'];
const init = (over = {}) => ({ model: 'claude-sonnet-5-5', tools: ['Bash', 'Edit', 'Read'], plugins: [], skills: [], mcp_servers: [], ...over });
const check = (over, arm = 'A') => startupProblems(init(over), { arm, model: 'claude-sonnet-5-5' });

test('the locked-down start of arms A and B, and of C with its server, is accepted', () => {
  assert.deepEqual(check({}), []);
  assert.deepEqual(check({}, 'B'), []);
  assert.deepEqual(check({ tools: ['Bash', 'Edit', 'Read', ...TESTIVAI], mcp_servers: [{ name: 'testivai', status: 'connected' }] }, 'C'), []);
  assert.deepEqual(check({ skills: undefined, plugins: undefined }), [], 'a report without these lists has none loaded');
});

test('a model other than the pinned one is refused', () => {
  assert.match(check({ model: 'claude-opus-5-5' }).join('\n'), /model claude-opus-5-5.*claude-sonnet-5-5/);
});

test('any tool beyond Bash, Edit and Read is refused, and a missing one too', () => {
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', 'WebFetch'] }).join('\n'), /WebFetch/);
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', 'SendMessage', 'CronCreate'] }).join('\n'), /SendMessage.*CronCreate|CronCreate.*SendMessage/);
  assert.match(check({ tools: ['Bash', 'Read'] }).join('\n'), /missing.*Edit/);
});

test('testivai tools only in arm C, and C needs them', () => {
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', ...TESTIVAI], mcp_servers: [{ name: 'testivai', status: 'connected' }] }, 'B').join('\n'), /mcp__testivai|MCP/);
  assert.match(check({ mcp_servers: [{ name: 'testivai', status: 'connected' }] }, 'C').join('\n'), /no testivai tools/);
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', 'mcp__other__x'], mcp_servers: [{ name: 'testivai', status: 'connected' }] }, 'C').join('\n'), /mcp__other__x/);
});

test('the testivai server must be connected in C, and be the only server', () => {
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', ...TESTIVAI], mcp_servers: [{ name: 'testivai', status: 'failed' }] }, 'C').join('\n'), /testivai.*failed/);
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', ...TESTIVAI], mcp_servers: [] }, 'C').join('\n'), /testivai/);
  assert.match(check({ tools: ['Bash', 'Edit', 'Read', ...TESTIVAI], mcp_servers: [{ name: 'testivai', status: 'connected' }, { name: 'x', status: 'connected' }] }, 'C').join('\n'), /x/);
});

test('plugins and skills from the machine are refused', () => {
  assert.match(check({ plugins: [{ name: 'cc-plugin-privacy' }] }).join('\n'), /plugin.*cc-plugin-privacy/);
  assert.match(check({ skills: ['deep-research'] }).join('\n'), /skill.*deep-research/);
});
