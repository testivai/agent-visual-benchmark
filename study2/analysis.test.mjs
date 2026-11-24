import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapP, holm, analyzeStudy2 } from './analysis.mjs';

test('bootstrap p-values: the share of resampled means on the wrong side of 0', () => {
  assert.equal(bootstrapP([0.2, 0.4, 0.1], { sided: 'greater' }), 0);
  assert.equal(bootstrapP([-0.2, -0.4], { sided: 'greater' }), 1);
  assert.equal(bootstrapP([0, 0, 0], { sided: 'greater' }), 1, 'no difference is no evidence');
  const p = bootstrapP([1, -1], { sided: 'greater', resamples: 10000, seed: 1 });
  assert.ok(p > 0.7 && p < 0.8, `half the resamples are 0, a quarter below: ${p}`);
  assert.equal(bootstrapP([0.7, 0.7], { sided: 'two' }), 0);
  assert.equal(bootstrapP([-0.7, -0.7], { sided: 'two' }), 0);
  assert.equal(bootstrapP([0, 0], { sided: 'two' }), 1, 'capped at 1');
});

test('Holm at 5% for two tests: the smaller p against 2.5%, then the other against 5%', () => {
  assert.deepEqual(holm([0.01, 0.04]).map((h) => h.rejected), [true, true]);
  assert.deepEqual(holm([0.04, 0.01]).map((h) => h.rejected), [true, true]);
  assert.deepEqual(holm([0.03, 0.04]).map((h) => h.rejected), [false, false], '0.03 is above 2.5%, so the procedure stops');
  assert.deepEqual(holm([0.001, 0.2]).map((h) => h.rejected), [true, false]);
  assert.deepEqual(holm([0.01, 0.04]).map((h) => h.adjusted), [0.02, 0.04]);
  assert.deepEqual(holm([0.04, 0.03]).map((h) => h.adjusted), [0.06, 0.06], 'adjusted values never fall below an earlier one');
});

// tasks: [{ id, stratum }]; runs: [task, arm, success, tokens, partial?]
function study(rows) {
  const tasks = [...new Map(rows.map(([id, stratum]) => [id, { id, stratum }])).values()];
  const records = rows.map(([task, , arm, success, tokens, share], i) => ({
    run_id: `r${i}`, task, arm, repeat: 1, success, error: null, false_done: false, collateral_clean: true, tampered: false,
    turns: 5, seconds: 10, cost_usd: 0.1, tokens: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0 },
    ...(share === undefined ? {} : { partial_credit: { share } }),
  }));
  return { tasks, records };
}

function better(n, { cTokens = 200, bTokens = 100 } = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const stratum = ['S1', 'S2', 'S3'][i % 3];
    const id = `t${i}`;
    const share = stratum === 'S2' ? [1, 0.5] : [undefined, undefined];
    rows.push([id, stratum, 'C', true, cTokens, share[0]], [id, stratum, 'C', true, cTokens, share[0]]);
    rows.push([id, stratum, 'B', i % 2 === 0, bTokens, share[1]], [id, stratum, 'B', false, bTokens, share[1]]);
  }
  rows.push(['d0', 'S4', 'C', false, 50], ['d0', 'S4', 'B', true, 50]);
  return study(rows);
}

test('the primary test, H2, Holm and the kill line, over S1 to S3; S4 is reported on its own', () => {
  const { tasks, records } = better(30);
  const r = analyzeStudy2(records, { tasks, resamples: 2000 });
  assert.equal(r.primary['C-B'].n, 30, 'the decoy is not in the primary comparison');
  assert.ok(Math.abs(r.primary['C-B'].mean - 0.75) < 1e-12);
  assert.equal(r.decoys['C-B'].n, 1);
  assert.equal(r.h1.p, 0);
  assert.ok(Math.abs(r.h2.ratio - 2) < 1e-9, 'C used twice the tokens of B');
  assert.equal(r.h2.p, 0);
  assert.equal(r.h2.tasks, 30);
  assert.deepEqual(r.holm.map((h) => [h.test, h.rejected]), [['H1', true], ['H2', true]]);
  assert.equal(r.verdict.h1Supported, true);
  assert.equal(r.verdict.killLine, false);
  assert.deepEqual(Object.keys(r.byCategory).sort(), ['S1', 'S2', 'S3', 'S4'], 'each stratum on its own');
});

test('a small but sure difference: H1 may hold, yet under 10 points the kill line is reached', () => {
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const stratum = ['S1', 'S2', 'S3'][i % 3];
    const cWins = i % 20 === 0;
    for (let k = 0; k < 2; k++) rows.push([`t${i}`, stratum, 'C', cWins ? true : k === 0, 100], [`t${i}`, stratum, 'B', k === 0, 100]);
  }
  const { tasks, records } = study(rows);
  const r = analyzeStudy2(records, { tasks, resamples: 2000 });
  assert.ok(Math.abs(r.primary['C-B'].mean - 0.025) < 1e-12);
  assert.equal(r.verdict.killLine, true);
  assert.equal(r.h2.p, 1, 'the same tokens: no difference');
});

test('partial credit in S2: the mean share restored per arm, and paired by task', () => {
  const { tasks, records } = better(30);
  const r = analyzeStudy2(records, { tasks, resamples: 2000 });
  assert.deepEqual(r.partialCredit.perArm, { B: { runs: 20, meanShare: 0.5 }, C: { runs: 20, meanShare: 1 } });
  assert.equal(r.partialCredit.paired.n, 10);
  assert.ok(Math.abs(r.partialCredit.paired.mean - 0.5) < 1e-12);
});

test('the tasks where B beat C are listed, as prominently as the reverse', () => {
  const { tasks, records } = better(6);
  const r = analyzeStudy2(records, { tasks, resamples: 500 });
  assert.deepEqual(r.bBeatC.map((t) => t.task), ['d0']);
  assert.equal(r.cBeatB.length, 6);
});

test('the p-value and study 1\'s interval come from the same resamples: lower bound above 0 exactly when p is under 5%', async () => {
  const { bootstrapMean } = await import('../analysis/stats.mjs');
  const { mulberry32 } = await import('../runner/rng.mjs');
  const random = mulberry32(7);
  let agreeing = 0;
  for (let k = 0; k < 40; k++) {
    const shift = (k - 20) / 100;
    const values = Array.from({ length: 30 }, () => Math.round((random() - 0.5 + shift) * 3) / 3);
    const lower = bootstrapMean(values, { resamples: 2000, seed: 1 }).lowerOneSided;
    const p = bootstrapP(values, { sided: 'greater', resamples: 2000, seed: 1 });
    assert.ok(p <= 0.05 || lower <= 0, `shift ${shift}: p ${p}, lower ${lower}`);
    if ((lower > 0) === (p < 0.05)) agreeing += 1;
  }
  assert.ok(agreeing >= 38, `${agreeing} of 40 agree; they can differ only at the boundary`);
});
