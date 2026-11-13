import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wilson, median, bootstrapMean, finalRecords } from './stats.mjs';
import { analyze, renderSummary, toCsv } from './analyze.mjs';

const close = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('Wilson 95% intervals match known values', () => {
  const half = wilson(5, 10);
  close(half.rate, 0.5);
  close(half.low, 0.2366);
  close(half.high, 0.7634);
  const none = wilson(0, 10);
  close(none.low, 0);
  close(none.high, 0.2775);
  const all = wilson(10, 10);
  close(all.low, 0.7225);
  close(all.high, 1);
  assert.deepEqual(wilson(0, 0), { rate: null, low: null, high: null });
});

test('median of odd and even lists, and of nothing', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([null, 5, undefined]), 5);
});

test('the bootstrap is reproducible from its seed and brackets the mean', () => {
  const values = [0, 0.2, 0.4, 1, 0.6, 0.8, 0.2, 0];
  const a = bootstrapMean(values, { resamples: 2000, seed: 3 });
  const b = bootstrapMean(values, { resamples: 2000, seed: 3 });
  assert.deepEqual(a, b);
  close(a.mean, 0.4);
  assert.ok(a.low < a.mean && a.mean < a.high);
  assert.deepEqual(bootstrapMean([0.5, 0.5, 0.5], { resamples: 500, seed: 1 }), { mean: 0.5, low: 0.5, high: 0.5, lowerOneSided: 0.5, n: 3 });
  assert.deepEqual(bootstrapMean([], { resamples: 10, seed: 1 }), { mean: null, low: null, high: null, lowerOneSided: null, n: 0 });
});

test('the one-sided 95% lower bound is the 5th percentile of the resampled means', () => {
  const values = [0, 0.2, 0.4, 1, 0.6, 0.8, 0.2, 0];
  const b = bootstrapMean(values, { resamples: 4000, seed: 5 });
  assert.ok(b.low < b.lowerOneSided && b.lowerOneSided < b.mean, `${b.low} < ${b.lowerOneSided} < ${b.mean}`);
  // the same resamples, cut at 90% two-sided, give the same lower end
  close(bootstrapMean(values, { resamples: 4000, seed: 5, level: 0.9 }).low, b.lowerOneSided);
});

test('the last attempt of each run is the one that counts', () => {
  const recs = [
    { run_id: 'r1', attempt: 1, error: { stage: 'agent' } },
    { run_id: 'r2', attempt: 1, success: true, error: null },
    { run_id: 'r1', attempt: 2, success: false, error: null },
  ];
  assert.deepEqual(finalRecords(recs).map((r) => `${r.run_id}:${r.attempt}`), ['r1:2', 'r2:1']);
});

// Two fix tasks and a decoy, three arms, two repeats each.
//   t1 (fix/style): A 0/2, B 1/2, C 2/2
//   t2 (fix/stack): A 1/2, B 2/2, C 1/2   <- B beat C here
//   d1 (decoy):     A 2/2, B 0/2, C 2/2
const SUCCESS = { t1: { A: [0, 0], B: [1, 0], C: [1, 1] }, t2: { A: [1, 0], B: [1, 1], C: [1, 0] }, d1: { A: [1, 1], B: [0, 0], C: [1, 1] } };
const META = { t1: ['fix', 'style-only'], t2: ['fix', 'stacking-order'], d1: ['decoy', 'no-defect'] };
// runs that removed the symptom without restoring the values: a lenient success only
const LENIENT_ONLY = new Set(['t1/A/0']);

function records() {
  const out = [];
  let n = 0;
  for (const [task, arms] of Object.entries(SUCCESS)) {
    for (const [arm, outcomes] of Object.entries(arms)) {
      outcomes.forEach((ok, i) => {
        n += 1;
        out.push({
          phase: 'pilot', run_id: `p-${n}`, attempt: 1, task, arm, repeat: i + 1, task_type: META[task][0], task_category: META[task][1],
          success: Boolean(ok), fixed: Boolean(ok), lenient_success: Boolean(ok) || LENIENT_ONLY.has(`${task}/${arm}/${i}`), collateral_clean: arm === 'B' && task === 'd1' ? false : true, tampered: false,
          claimed_done: true, false_done: !ok, turns: 10 + n, tokens: { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0 },
          cost_usd: 1, seconds: 100, flags: arm === 'B' && i === 0 ? ['viewed_baseline'] : [], stop_reason: 'completed', error: null,
        });
      });
    }
  }
  // an errored run (both attempts) is excluded from the rates and reported
  out.push({ phase: 'pilot', run_id: 'p-err', attempt: 1, task: 't1', arm: 'C', repeat: 3, task_type: 'fix', task_category: 'style-only', error: { stage: 'agent', message: 'x' } });
  out.push({ phase: 'pilot', run_id: 'p-err', attempt: 2, task: 't1', arm: 'C', repeat: 3, task_type: 'fix', task_category: 'style-only', error: { stage: 'agent', message: 'x' } });
  return out;
}

const result = analyze(records(), { arms: ['A', 'B', 'C'], resamples: 2000, seed: 1, fullRuns: 360 });

test('success rate per arm over scored runs, with errors counted apart', () => {
  assert.equal(result.runs.scored, 18);
  assert.equal(result.runs.errors, 1);
  assert.deepEqual([result.perArm.A.successes, result.perArm.A.n], [3, 6]);
  assert.deepEqual([result.perArm.B.successes, result.perArm.B.n], [3, 6]);
  assert.deepEqual([result.perArm.C.successes, result.perArm.C.n], [5, 6]);
  close(result.perArm.C.wilson.rate, 5 / 6);
});

test('per-task rates are the mean of the repeats', () => {
  const t2 = result.perTask.find((t) => t.task === 't2');
  assert.deepEqual([t2.A, t2.B, t2.C], [0.5, 1, 0.5]);
});

test('the primary comparison is paired by task over the fix and change tasks only', () => {
  // C-B per task: t1 1-0.5 = 0.5, t2 0.5-1 = -0.5 -> mean 0; the decoy is not in it
  close(result.primary['C-B'].mean, 0);
  assert.equal(result.primary['C-B'].n, 2);
  // C-A: t1 1, t2 0 -> 0.5
  close(result.primary['C-A'].mean, 0.5);
  const cb = result.primary['C-B'];
  assert.ok(cb.low <= cb.lowerOneSided && cb.lowerOneSided <= cb.mean);
  assert.deepEqual(result.primary.tasks, ['t1', 't2']);
});

test('decoys are compared on their own', () => {
  // d1: C 1 - B 0
  close(result.decoys['C-B'].mean, 1);
  assert.equal(result.decoys['C-B'].n, 1);
  assert.deepEqual(result.decoys.tasks, ['d1']);
});

test('the lenient rate: the symptom gone, over the fix and change tasks', () => {
  assert.deepEqual([result.lenient.perArm.A.successes, result.lenient.perArm.A.n], [2, 4]);
  assert.deepEqual([result.lenient.perArm.C.successes, result.lenient.perArm.C.n], [3, 4]);
  // C-A lenient: t1 1 - 0.5 = 0.5, t2 0.5 - 0.5 = 0 -> 0.25
  close(result.lenient.paired['C-A'].mean, 0.25);
  assert.equal(result.lenient.paired['C-A'].n, 2);
});

test('runs with no lenient verdict are left out of the lenient rate only', () => {
  const recs = records().map((r) => (r.run_id === 'p-1' ? { ...r, lenient_success: null } : r));
  const r = analyze(recs, { arms: ['A', 'B', 'C'], resamples: 100, seed: 1 });
  assert.equal(r.lenient.perArm.A.n, 3);
  assert.equal(r.perArm.A.n, 6);
});

test('tasks where B beat C are listed, and tasks where C beat B', () => {
  assert.deepEqual(result.bBeatC.map((t) => t.task), ['t2']);
  assert.deepEqual(result.cBeatB.map((t) => t.task).sort(), ['d1', 't1']);
});

test('by type and category', () => {
  assert.deepEqual([result.byType.decoy.B.successes, result.byType.decoy.B.n], [0, 2]);
  assert.deepEqual([result.byCategory['stacking-order'].B.successes, result.byCategory['stacking-order'].B.n], [2, 2]);
});

test('false done, collateral breakage, medians, cost and shortcut flags per arm', () => {
  assert.deepEqual([result.perArm.A.falseDone.k, result.perArm.A.falseDone.n], [3, 6]);
  assert.deepEqual([result.perArm.B.collateralBroken.k, result.perArm.B.collateralBroken.n], [2, 6]);
  assert.equal(result.perArm.A.medianSeconds, 100);
  assert.equal(result.perArm.A.medianTokens, 1100);
  assert.deepEqual(result.flags.B, { viewed_baseline: 3 });
  close(result.cost.meanPerRun, 1);
  close(result.cost.projectedFull, 360);
});

test('tasks no arm can tell apart (all 0% or all 100%) are listed', () => {
  const r = analyze([
    ...['A', 'B', 'C'].map((arm, i) => ({ run_id: `x${i}`, attempt: 1, task: 'easy', arm, task_type: 'fix', task_category: 'c', success: true, error: null, flags: [] })),
    ...['A', 'B', 'C'].map((arm, i) => ({ run_id: `y${i}`, attempt: 1, task: 'hard', arm, task_type: 'fix', task_category: 'c', success: false, error: null, flags: [] })),
  ], { arms: ['A', 'B', 'C'], resamples: 100, seed: 1, fullRuns: 360 });
  assert.deepEqual(r.extremes, [{ task: 'easy', all: 1 }, { task: 'hard', all: 0 }]);
});

test('the summary shows where B beat C as prominently as the reverse, and makes no significance claim in a pilot', () => {
  const md = renderSummary(result, { phase: 'pilot', model: 'sonnet' });
  assert.match(md, /^# Results: sonnet, pilot$/m);
  const bc = md.indexOf('## Tasks where B beat C');
  const cb = md.indexOf('## Tasks where C beat B');
  assert.ok(bc > 0 && cb > 0, 'both sections, at the same heading level');
  assert.ok(bc < cb, 'B over C comes first');
  assert.match(md, /no significance/i);
  assert.match(md, /\| t2 \|/);
  assert.match(md, /errors?: 1/i);
  assert.match(md, /projected/i);
});

test('CSV quotes what needs quoting', () => {
  assert.equal(toCsv([{ a: 1, b: 'x,y' }, { a: 2, b: 'say "hi"' }], ['a', 'b']), 'a,b\n1,"x,y"\n2,"say ""hi"""\n');
});

test('more than 5% of runs ending in two errors is said before any result', () => {
  // 1 of 19 runs = 5.3%
  assert.equal(result.runs.errorShare > 0.05, true);
  const md = renderSummary(result, { phase: 'full', model: 'sonnet', primary: true });
  const warning = md.search(/more than 5% of runs/i);
  assert.ok(warning > 0 && warning < md.indexOf('## Per arm'), 'before the results');
  const fewer = analyze(records().filter((r) => r.run_id !== 'p-err'), { arms: ['A', 'B', 'C'], resamples: 100, seed: 1 });
  assert.doesNotMatch(renderSummary(fewer, { phase: 'full', model: 'sonnet', primary: true }), /more than 5% of runs/i);
});

// 20 fix tasks, one run per arm each; C succeeds on `cWins` tasks where B fails.
function study(cWins) {
  const out = [];
  for (let t = 0; t < 20; t++) {
    for (const arm of ['A', 'B', 'C']) {
      const ok = arm === 'C' ? t < cWins || t >= 10 : t >= 10;
      out.push({ run_id: `s${t}${arm}`, attempt: 1, task: `t${String(t).padStart(2, '0')}`, arm, task_type: 'fix', task_category: 'c',
        success: ok, lenient_success: ok, error: null, flags: [] });
    }
  }
  return out;
}

const KILL = 'TestivAI did not measurably help over a pixel comparison in this study';

test('the kill line is judged only in the full study of the primary model', () => {
  const weak = analyze(study(1), { arms: ['A', 'B', 'C'], resamples: 2000, seed: 1 }); // C-B = 5 points
  assert.match(renderSummary(weak, { phase: 'full', model: 'sonnet', primary: true }), new RegExp(KILL));
  assert.doesNotMatch(renderSummary(weak, { phase: 'pilot', model: 'sonnet', primary: true }), new RegExp(KILL));
  const replication = renderSummary(weak, { phase: 'full', model: 'opus', primary: false });
  assert.doesNotMatch(replication, new RegExp(KILL));
  assert.match(replication, /replication/i);
});

test('the kill line: under 10 points, or a one-sided interval that reaches 0', () => {
  const strong = analyze(study(8), { arms: ['A', 'B', 'C'], resamples: 2000, seed: 1 }); // C-B = 40 points
  assert.equal(strong.primary['C-B'].lowerOneSided > 0, true);
  const md = renderSummary(strong, { phase: 'full', model: 'sonnet', primary: true });
  assert.doesNotMatch(md, new RegExp(KILL));
  assert.match(md, /H1 is supported/);
  const weak = analyze(study(1), { arms: ['A', 'B', 'C'], resamples: 2000, seed: 1 });
  assert.match(renderSummary(weak, { phase: 'full', model: 'sonnet', primary: true }), /H1 is not supported/);
});

test('the kill line is reached by an interval that reaches 0, even at 10 points or more', () => {
  // C beats B on 4 tasks, B beats C on 2, the rest tie: mean +10 points, a wide interval
  const recs = [];
  for (let t = 0; t < 20; t++) {
    const b = t >= 4 && t < 6 ? true : t >= 10;
    const c = t < 4 ? true : t >= 4 && t < 6 ? false : t >= 10;
    for (const [arm, ok] of [['A', false], ['B', b], ['C', c]]) {
      recs.push({ run_id: `k${t}${arm}`, attempt: 1, task: `t${String(t).padStart(2, '0')}`, arm, task_type: 'fix', task_category: 'c', success: ok, error: null, flags: [] });
    }
  }
  const r = analyze(recs, { arms: ['A', 'B', 'C'], resamples: 2000, seed: 1 });
  close(r.primary['C-B'].mean, 0.1);
  assert.ok(r.primary['C-B'].lowerOneSided <= 0, `lower bound ${r.primary['C-B'].lowerOneSided}`);
  assert.match(renderSummary(r, { phase: 'full', model: 'sonnet', primary: true }), new RegExp(KILL));
});

test('time per run is the agent\'s own when recorded, without waits for background tasks', () => {
  const recs = records().map((r) => (r.arm === 'A' && !r.error ? { ...r, seconds: 700, agent_seconds: 60 } : r));
  const r = analyze(recs, { arms: ['A', 'B', 'C'], resamples: 100, seed: 1 });
  assert.equal(r.perArm.A.medianSeconds, 60);
  assert.equal(r.perArm.B.medianSeconds, 100, 'the wall time when no agent time was recorded');
});

test('the summary says which records the transcripts corrected', () => {
  const rederived = { checked: 18, missing: 1, changed: [{ run_id: 'p-3', attempt: 1, fields: ['turns', 'claimed_done'] }] };
  const md = renderSummary(result, { phase: 'pilot', model: 'opus', rederived });
  assert.match(md, /read again from each transcript/i);
  assert.match(md, /1 of 18 runs differ from runs\.jsonl/);
  assert.match(md, /p-3 \(turns, claimed_done\)/);
  assert.match(md, /1 without a transcript/);
  assert.doesNotMatch(renderSummary(result, { phase: 'pilot', model: 'opus' }), /read again from each transcript/i);
});
