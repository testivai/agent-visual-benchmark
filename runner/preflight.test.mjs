import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthStatus, loginProblems } from './preflight.mjs';

test('the login state is read from claude auth status', () => {
  assert.deepEqual(parseAuthStatus('{"loggedIn": true, "authMethod": "oauth_token"}'), { loggedIn: true, authMethod: 'oauth_token' });
  assert.deepEqual(parseAuthStatus('{"loggedIn": false}'), { loggedIn: false, authMethod: null });
  assert.deepEqual(parseAuthStatus('not json'), { loggedIn: false, authMethod: null });
});

const auth = (loggedIn) => ({ loggedIn, authMethod: loggedIn ? 'oauth_token' : null });

test('a subscription model needs a Claude login and no API key that would take its place', () => {
  const agent = { id: 'sonnet', provider: 'anthropic-subscription' };
  assert.deepEqual(loginProblems(agent, {}, auth(true)), []);
  assert.match(loginProblems(agent, {}, auth(false)).join('\n'), /not logged in/);
  // the runner never passes the key to a subscription run, but say so if one is set
  assert.deepEqual(loginProblems(agent, { ANTHROPIC_API_KEY: 'k' }, auth(true)), []);
});

test('an API-key model needs ANTHROPIC_API_KEY', () => {
  const agent = { id: 'opus-key', provider: 'anthropic-api-key' };
  assert.match(loginProblems(agent, {}, auth(true)).join('\n'), /ANTHROPIC_API_KEY/);
  assert.deepEqual(loginProblems(agent, { ANTHROPIC_API_KEY: 'k' }, auth(false)), []);
});

test('another provider\'s model needs its key, or a network proxy holding it (said, not checked)', () => {
  const agent = { id: 'deepseek', provider: 'anthropic-compatible', authTokenEnv: 'DEEPSEEK_API_KEY' };
  assert.deepEqual(loginProblems(agent, { DEEPSEEK_API_KEY: 'k' }, auth(false)), []);
  assert.deepEqual(loginProblems(agent, {}, auth(false)), [], 'without the variable the proxy is relied on; the probe shows whether it works');
});
