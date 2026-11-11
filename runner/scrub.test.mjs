import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrub, secretValues } from './scrub.mjs';

test('known secret values are replaced wherever they appear', () => {
  const out = scrub('key=abc123secretvalue and again abc123secretvalue', ['abc123secretvalue']);
  assert.equal(out, 'key=[REDACTED] and again [REDACTED]');
});

test('anything shaped like an Anthropic key is replaced even when not known', () => {
  assert.equal(scrub('export ANTHROPIC_API_KEY=sk-ant-api03-AbC_d-123456789xyz done', []), 'export ANTHROPIC_API_KEY=[REDACTED] done');
  assert.equal(scrub('{"k":"sk-ant-oat01-ZZZZZZZZZZZZZZZZ"}', []), '{"k":"[REDACTED]"}');
});

test('short or empty "secrets" are ignored so ordinary text is not mangled', () => {
  assert.equal(scrub('a b c', ['', 'a', null, undefined]), 'a b c');
});

test('secretValues collects the values of the credential variables that are set', () => {
  const env = { ANTHROPIC_API_KEY: 'sk-ant-xxxxxxxxxxxxxxxx', ANTHROPIC_AUTH_TOKEN: 'tok-yyyyyyyyyy', PATH: '/usr/bin', CLAUDE_CODE_OAUTH_TOKEN: '' };
  assert.deepEqual(secretValues(env).sort(), ['sk-ant-xxxxxxxxxxxxxxxx', 'tok-yyyyyyyyyy']);
});
