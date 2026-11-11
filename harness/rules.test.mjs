import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaskOutcomes } from './rules.mjs';

const ok = { score: 'passed', collateral: 'passed', functional: 'passed' };
const seeded = { score: 'failed', collateral: 'passed', functional: 'passed' };
const wrong = { score: 'failed', collateral: 'passed' };

function fix(overrides = {}) {
  return { type: 'fix', seed: seeded, reference: ok, wrong, ...overrides };
}

test('a well-behaved fix task has no problems', () => {
  assert.deepEqual(checkTaskOutcomes(fix()), []);
});

test('a scorer that passes on the seeded state cannot fail, and is reported', () => {
  const problems = checkTaskOutcomes(fix({ seed: { ...seeded, score: 'passed' } }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /seed.*score.*must fail/i);
});

test('the seeded state must not already break the rest of the site', () => {
  const problems = checkTaskOutcomes(fix({ seed: { ...seeded, collateral: 'failed' } }));
  assert.match(problems.join('\n'), /seed.*collateral.*must pass/i);
});

test('the reference fix must pass both specs', () => {
  assert.match(
    checkTaskOutcomes(fix({ reference: { ...ok, score: 'failed' } })).join('\n'),
    /reference.*score.*must pass/i,
  );
  assert.match(
    checkTaskOutcomes(fix({ reference: { ...ok, collateral: 'failed' } })).join('\n'),
    /reference.*collateral.*must pass/i,
  );
});

test('the reference fix must keep the functional suite green', () => {
  assert.match(
    checkTaskOutcomes(fix({ reference: { ...ok, functional: 'failed' } })).join('\n'),
    /reference.*functional.*must pass/i,
  );
});

test('a wrong fix that passes both specs is reported', () => {
  const problems = checkTaskOutcomes(fix({ wrong: { score: 'passed', collateral: 'passed' } }));
  assert.match(problems.join('\n'), /wrong.*at least one/i);
});

test('a wrong fix caught only by collateral is fine', () => {
  assert.deepEqual(checkTaskOutcomes(fix({ wrong: { score: 'passed', collateral: 'failed' } })), []);
});

test('change tasks follow the fix rules', () => {
  assert.deepEqual(checkTaskOutcomes({ ...fix(), type: 'change' }), []);
  assert.match(
    checkTaskOutcomes({ ...fix({ seed: { ...seeded, score: 'passed' } }), type: 'change' }).join('\n'),
    /must fail/i,
  );
});

test('a decoy passes on the seeded state, with the functional suite green', () => {
  const decoy = { type: 'decoy', seed: ok, reference: ok, wrong };
  assert.deepEqual(checkTaskOutcomes(decoy), []);
  assert.match(
    checkTaskOutcomes({ ...decoy, seed: { ...ok, score: 'failed' } }).join('\n'),
    /seed.*score.*must pass/i,
  );
  assert.match(
    checkTaskOutcomes({ ...decoy, seed: { ...ok, functional: 'failed' } }).join('\n'),
    /seed.*functional.*must pass/i,
  );
});

test('a spec that errors is neither a pass nor a fail', () => {
  const problems = checkTaskOutcomes(fix({ seed: { ...seeded, score: 'error' } }));
  assert.match(problems.join('\n'), /seed.*score.*error/i);
  // an erroring scorer must not satisfy "the wrong fix fails"
  const wrongErr = checkTaskOutcomes(fix({ wrong: { score: 'error', collateral: 'passed' } }));
  assert.match(wrongErr.join('\n'), /wrong.*score.*error/i);
  assert.match(wrongErr.join('\n'), /wrong.*at least one/i);
});

test('a missing outcome is reported, not treated as a pass', () => {
  const problems = checkTaskOutcomes(fix({ reference: { score: 'passed' } }));
  assert.match(problems.join('\n'), /reference.*collateral.*missing/i);
});

test('an unknown task type is reported', () => {
  assert.match(checkTaskOutcomes({ ...fix(), type: 'other' }).join('\n'), /unknown task type/i);
});
