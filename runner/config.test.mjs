import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig, validateConfig, configHash } from './config.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';

const good = () => structuredClone(loadConfig(path.join(REPO_ROOT, 'runner.config.json')));

test('the committed config is valid', () => {
  assert.deepEqual(validateConfig(good()), []);
});

test('bad values are named', () => {
  const bad = (edit) => { const c = good(); edit(c); return validateConfig(c).join('\n'); };
  assert.match(bad((c) => { c.agent.model = ''; }), /agent\.model/);
  assert.match(bad((c) => { c.agent.maxTurns = 0; }), /agent\.maxTurns/);
  assert.match(bad((c) => { c.agent.timeLimitMinutes = -1; }), /agent\.timeLimitMinutes/);
  assert.match(bad((c) => { c.agent.command = 'claude'; }), /agent\.command/);
  assert.match(bad((c) => { c.agent.effort = 'turbo'; }), /agent\.effort/);
  assert.match(bad((c) => { c.arms = ['A', 'D']; }), /arms/);
  assert.match(bad((c) => { c.isolation = 'docker'; }), /isolation/);
  assert.match(bad((c) => { c.repeats.full = 0; }), /repeats\.full/);
  assert.match(bad((c) => { c.seeds.order = 1.5; }), /seeds\.order/);
  assert.match(bad((c) => { c.concurrency = 0; }), /concurrency/);
});

test('the hash covers what changes a run, not how many run at once', () => {
  const a = good();
  const b = good();
  b.concurrency = 4;
  assert.equal(configHash(a), configHash(b));
  b.agent.model = 'claude-sonnet-5-5';
  assert.notEqual(configHash(a), configHash(b));
  const c = good();
  c.agent = Object.fromEntries(Object.entries(c.agent).reverse());
  assert.equal(configHash(c), configHash(a), 'key order does not matter');
});
