import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageLimit, waitFor, runCost } from './limits.mjs';

const NOW = Date.parse('2026-11-12T10:00:00Z');
const parsed = (finalText, over = {}) => ({ hasResult: true, isError: true, subtype: 'success', finalText, ...over });
const agentRes = (stderrTail = '') => ({ stderrTail });

test('a subscription limit with a reset time in its message', () => {
  const resetAt = Math.floor(Date.parse('2026-11-12T13:00:00Z') / 1000);
  const l = usageLimit(parsed(`Claude AI usage limit reached|${resetAt}`), agentRes());
  assert.equal(l.resetAt, '2026-11-12T13:00:00.000Z');
  assert.match(l.message, /usage limit/);
});

test('limits and overload worded in other ways are recognised, without a reset time', () => {
  for (const text of [
    "You've hit your session limit · resets 5pm (UTC)",
    "You've hit your weekly limit",
    'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"Number of requests has exceeded your rate limit"}}',
    'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    'Rate limit exceeded, please try again later',
  ]) {
    const l = usageLimit(parsed(text), agentRes());
    assert.ok(l, text);
    assert.equal(l.resetAt, null, text);
  }
});

test('the reason can be in the error output instead of the final message', () => {
  assert.ok(usageLimit({ hasResult: false, finalText: '' }, agentRes('Error: 429 rate_limit_error')));
});

test('a normal end, a crash or an ordinary API error is not a limit', () => {
  assert.equal(usageLimit(parsed('I fixed it.\nSTATUS: DONE', { isError: false }), agentRes()), null);
  assert.equal(usageLimit({ hasResult: false, finalText: '' }, agentRes('boom: crashed')), null);
  assert.equal(usageLimit(parsed('API Error: 400 invalid_request_error'), agentRes()), null);
  assert.equal(usageLimit(parsed('Invalid API key · Fix external API key'), agentRes()), null);
  // an agent that merely talks about rate limits in a successful run did not hit one
  assert.equal(usageLimit(parsed('The page has no rate limit issue.\nSTATUS: DONE', { isError: false }), agentRes()), null);
});

test('the wait: until the reset plus a minute when known, else 15 minutes doubling up to 2 hours', () => {
  assert.equal(waitFor({ resetAt: '2026-11-12T13:00:00.000Z' }, 0, NOW), 3 * 3600 * 1000 + 60000);
  assert.equal(waitFor({ resetAt: null }, 0, NOW), 15 * 60000);
  assert.equal(waitFor({ resetAt: null }, 1, NOW), 30 * 60000);
  assert.equal(waitFor({ resetAt: null }, 5, NOW), 2 * 3600 * 1000);
  assert.equal(waitFor({ resetAt: '2026-11-12T09:00:00.000Z' }, 0, NOW), 60000, 'a reset in the past: a minute');
  assert.equal(waitFor({ resetAt: '2026-11-20T09:00:00.000Z' }, 0, NOW), 12 * 3600 * 1000, 'never more than 12 hours at a time');
});

test('cost from a provider\'s prices per million tokens', () => {
  const prices = { input: 0.3, cacheRead: 0.006, cacheWrite: 0.3, output: 1.2 };
  const cost = runCost({ input: 1_000_000, output: 500_000, cacheRead: 2_000_000, cacheWrite: 100_000 }, prices);
  assert.ok(Math.abs(cost - (0.3 + 0.6 + 0.012 + 0.03)) < 1e-9);
  assert.equal(runCost(null, prices), null);
});
