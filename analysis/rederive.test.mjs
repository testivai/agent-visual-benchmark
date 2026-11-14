import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rederive, applyTranscripts } from './rederive.mjs';

const line = (o) => JSON.stringify(o);
const init = { type: 'system', subtype: 'init', cwd: '/tmp/avb-r1/project', model: 'm', tools: ['Bash'] };
const call = (command) => line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command } }] } });
const result = (over) => line({ type: 'result', subtype: 'success', is_error: false, num_turns: 30, duration_ms: 60000, total_cost_usd: 0.4, result: 'Fixed.\nSTATUS: DONE', ...over });
// the answer, then a wake-up for a background task (the stream the old parser misread)
const woken = [result({}), result({ num_turns: 1, duration_ms: 2000, result: 'The server stopped; the fix stands.' })].join('\n');
const recorded = { run_id: 'p-1', attempt: 1, success: true, error: null, turns: 1, claimed_done: null, false_done: null, seconds: 660 };

test('turns, the done claim and agent time are read again from the transcript', () => {
  assert.deepEqual(rederive(recorded, woken), { turns: 31, claimed_done: true, false_done: false, agent_seconds: 62, result_count: 2, flags: [] });
  assert.equal(rederive({ ...recorded, success: false }, woken).false_done, true);
  assert.equal(rederive(recorded, result({ result: 'I could not find it.' })).claimed_done, null);
});

test('shortcut flags are read again too, with the run\'s workspace from the transcript', () => {
  const text = [line(init), call('diff -r /tmp/avb-template-1/project/site site'), result({})].join('\n');
  assert.deepEqual(rederive(recorded, text, { benchRoot: '/home/user/bench' }).flags, ['outside_workspace']);
  const own = [line(init), call('ls /tmp/avb-r1/tmp'), result({})].join('\n');
  assert.deepEqual(rederive(recorded, own, { benchRoot: '/home/user/bench' }).flags, []);
});

test('records are merged with what their transcripts say; the differences are listed', () => {
  const plain = { ...recorded, run_id: 'p-2', turns: 30, claimed_done: true, false_done: false };
  const errored = { run_id: 'p-3', attempt: 2, error: { stage: 'agent' }, turns: 5 };
  const missing = { ...recorded, run_id: 'p-4' };
  const transcripts = { 'p-1-a1': woken, 'p-2-a1': result({}), 'p-3-a2': woken };
  const out = applyTranscripts([recorded, plain, errored, missing], (r) => transcripts[`${r.run_id}-a${r.attempt}`] ?? null);
  assert.deepEqual(out.records[0], { ...recorded, turns: 31, claimed_done: true, false_done: false, agent_seconds: 62, result_count: 2, flags: [] });
  assert.equal(out.records[1].agent_seconds, 60);
  assert.deepEqual(out.records[2], errored, 'an errored attempt is left as recorded');
  assert.deepEqual(out.records[3], missing, 'no transcript, nothing changes');
  assert.deepEqual(out.changed, [{ run_id: 'p-1', attempt: 1, fields: ['turns', 'claimed_done', 'false_done'] }]);
  assert.equal(out.checked, 2);
  assert.equal(out.missing, 1);
});
