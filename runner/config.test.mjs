import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig, validateConfig, configHash, selectModel, primaryModel } from './config.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';

const good = () => structuredClone(loadConfig(path.join(REPO_ROOT, 'runner.config.json')));

test('the committed config is valid, with Sonnet 5.5 as the primary model', () => {
  assert.deepEqual(validateConfig(good()), []);
  assert.equal(primaryModel(good()), 'sonnet');
  assert.deepEqual(Object.keys(good().models), ['sonnet', 'opus', 'deepseek']);
});

test('bad shared values are named', () => {
  const bad = (edit) => { const c = good(); edit(c); return validateConfig(c).join('\n'); };
  assert.match(bad((c) => { c.agent.maxTurns = 0; }), /agent\.maxTurns/);
  assert.match(bad((c) => { c.agent.timeLimitMinutes = -1; }), /agent\.timeLimitMinutes/);
  assert.match(bad((c) => { c.agent.command = 'claude'; }), /agent\.command/);
  assert.match(bad((c) => { c.agent.effort = 'turbo'; }), /agent\.effort/);
  assert.match(bad((c) => { c.agent.model = 'x'; }), /agent\.model.*models/);
  assert.match(bad((c) => { c.arms = ['A', 'D']; }), /arms/);
  assert.match(bad((c) => { c.isolation = 'docker'; }), /isolation/);
  assert.match(bad((c) => { c.repeats.full = 0; }), /repeats\.full/);
  assert.match(bad((c) => { c.seeds.order = 1.5; }), /seeds\.order/);
  assert.match(bad((c) => { c.concurrency = 0; }), /concurrency/);
});

test('bad model entries are named', () => {
  const bad = (edit) => { const c = good(); edit(c); return validateConfig(c).join('\n'); };
  assert.match(bad((c) => { c.models = {}; }), /models/);
  assert.match(bad((c) => { c.models.opus.model = ''; }), /models\.opus\.model/);
  assert.match(bad((c) => { c.models.opus.provider = 'openai'; }), /models\.opus\.provider/);
  assert.match(bad((c) => { c.models.opus.primary = true; }), /exactly one primary/);
  assert.match(bad((c) => { delete c.models.sonnet.primary; }), /exactly one primary/);
  assert.match(bad((c) => { delete c.models.deepseek.baseUrl; }), /models\.deepseek\.baseUrl/);
  assert.match(bad((c) => { c.models.deepseek.baseUrl = 'http://plain'; }), /models\.deepseek\.baseUrl/);
  assert.match(bad((c) => { delete c.models.deepseek.pricesPerMillionUsd; }), /models\.deepseek\.pricesPerMillionUsd/);
  assert.match(bad((c) => { c.models.deepseek.pricesPerMillionUsd.output = -1; }), /pricesPerMillionUsd\.output/);
  assert.match(bad((c) => { delete c.models.deepseek.authTokenEnv; }), /models\.deepseek\.authTokenEnv/);
  assert.match(bad((c) => { c.models['bad id'] = { ...c.models.opus }; }), /bad id/);
});

test('selecting a model merges its entry into the agent settings', () => {
  const c = selectModel(good(), 'deepseek');
  assert.equal(c.agent.id, 'deepseek');
  assert.equal(c.agent.model, 'deepseek-flash');
  assert.equal(c.agent.provider, 'anthropic-compatible');
  assert.equal(c.agent.maxTurns, 60);
  assert.equal(c.model, 'deepseek');
  assert.throws(() => selectModel(good(), 'gpt'), /unknown model "gpt".*sonnet, opus, deepseek/);
});

test('the hash covers the shared settings and the selected model, not the others, and not concurrency', () => {
  const a = selectModel(good(), 'sonnet');
  const b = good();
  b.concurrency = 4;
  b.models.opus.model = 'claude-opus-6';
  assert.equal(configHash(a), configHash(selectModel(b, 'sonnet')), 'another model\'s entry does not change this one\'s runs');
  assert.notEqual(configHash(a), configHash(selectModel(good(), 'opus')));
  const c = good();
  c.agent.maxTurns = 40;
  assert.notEqual(configHash(a), configHash(selectModel(c, 'sonnet')));
  const d = good();
  d.agent = Object.fromEntries(Object.entries(d.agent).reverse());
  assert.equal(configHash(selectModel(d, 'sonnet')), configHash(a), 'key order does not matter');
});
