import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeStudy2, generationChecks } from './describe.mjs';

// rows: [task, stratum, arm, success, tokens]
function study(rows) {
  const tasks = [...new Map(rows.map(([id, stratum]) => [id, { id, stratum }])).values()];
  const records = rows.map(([task, , arm, success, tokens], i) => ({
    run_id: `r${i}`, attempt: 1, task, arm, success, error: null, cost_usd: 0.1,
    tokens: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  return { tasks, records };
}

test('tokens by stratum: the C/B ratio of per-task medians, paired, as H2 takes it, for each stratum on its own', () => {
  const { tasks, records } = study([
    ['a', 'S1', 'B', true, 100], ['a', 'S1', 'C', true, 200],
    ['b', 'S1', 'B', true, 300], ['b', 'S1', 'C', true, 600], ['b', 'S1', 'C', true, 600],
    ['c', 'S3', 'B', true, 400], ['c', 'S3', 'C', true, 200],
    ['d', 'S4', 'B', true, 100], ['d', 'S4', 'C', true, 100],
  ]);
  const { tokensByStratum } = describeStudy2(records, { tasks, resamples: 200 });
  assert.deepEqual(Object.keys(tokensByStratum), ['S1', 'S3', 'S4']);
  assert.equal(tokensByStratum.S1.tasks, 2);
  assert.ok(Math.abs(tokensByStratum.S1.ratio - 2) < 1e-9);
  assert.ok(Math.abs(tokensByStratum.S1.low - 2) < 1e-9 && Math.abs(tokensByStratum.S1.high - 2) < 1e-9);
  assert.ok(Math.abs(tokensByStratum.S3.ratio - 0.5) < 1e-9);
  assert.ok(Math.abs(tokensByStratum.S4.ratio - 1) < 1e-9);
});

test('errored runs and runs without a score are left out, as in the analysis', () => {
  const { tasks, records } = study([['a', 'S1', 'B', true, 100], ['a', 'S1', 'C', true, 200], ['a', 'S1', 'C', true, 900]]);
  records[2].error = { stage: 'agent', message: 'x' };
  assert.ok(Math.abs(describeStudy2(records, { tasks, resamples: 50 }).tokensByStratum.S1.ratio - 2) < 1e-9);
});

test('the pilot\'s own measures on these runs: pooled success over S1 to S3 and the per-task SD of C − B', () => {
  const { tasks, records } = study([
    ['a', 'S1', 'B', true, 1], ['a', 'S1', 'C', true, 1],
    ['b', 'S2', 'B', false, 1], ['b', 'S2', 'C', true, 1],
    ['d', 'S4', 'B', false, 1], ['d', 'S4', 'C', false, 1],
  ]);
  const { calibration } = describeStudy2(records, { tasks, resamples: 50 });
  assert.deepEqual(calibration.pooled, { successes: 3, runs: 4, rate: 0.75 });
  assert.equal(calibration.spread.tasks, 2);
  assert.ok(Math.abs(calibration.spread.sd - Math.SQRT1_2) < 1e-12, 'differences 0 and 1');
  assert.equal(typeof calibration.spread.powerAt60, 'number');
});

test('generation: of the candidates with a measured, visible change, which comparator flags them', () => {
  const stats = {
    candidates: 20,
    kept: 9,
    byClass: {
      colour: { kept: 5, rejected: { 'no measured change on a rendered element': 4, "arm B's check (Playwright) does not flag it": 2, "neither arm's check flags it": 1 } },
      margin: { kept: 4, rejected: { 'no pixel changed': 1, "arm C's check (TestivAI) does not flag it": 1, 'does not show together with the others': 1, 'a view could not be captured': 1 } },
    },
  };
  assert.deepEqual(generationChecks(stats), {
    candidates: 20,
    kept: 9,
    visible: 14,
    both: 10,
    onlyTestivai: 2,
    onlyPlaywright: 1,
    neither: 1,
    playwright: 11,
    testivai: 12,
  });
});
