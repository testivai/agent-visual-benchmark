// Study 2's analysis (study2/PREREGISTRATION.md, section 6). Study 1's
// analysis runs on the runs with each task's stratum as its category (S4 as
// the decoys); on top of it:
// - H1: C − B success over S1 to S3, paired by task; p is the share of
//   bootstrap resamples with a mean at or below 0;
// - H2: tokens per run over S1 to S3, the per-task median on a log scale,
//   paired; two-sided;
// - Holm's correction over the two at 5%; H1 is supported when Holm rejects it;
// - the kill line, as in study 1;
// - partial credit in S2, as description.
import { analyze } from '../analysis/analyze.mjs';
import { bootstrapMean, finalRecords, median } from '../analysis/stats.mjs';
import { mulberry32 } from '../runner/rng.mjs';

const ALPHA = 0.05;
const KILL_POINTS = 0.10;
const ARMS = ['B', 'C'];
const FULL_RUNS = 432;

// Resampled exactly as bootstrapMean resamples, so a p-value and an interval
// from the same values and seed come from the same resamples.
function resampledMeans(values, { resamples, seed }) {
  const random = mulberry32(seed);
  const means = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)];
    means.push(sum / values.length);
  }
  return means;
}

// sided 'greater': the share of resampled means at or below 0 (evidence that the
// mean is above 0); 'two': twice the smaller tail, at most 1.
export function bootstrapP(values, { sided, resamples = 10000, seed = 1 }) {
  if (values.length === 0) return null;
  const means = resampledMeans(values, { resamples, seed });
  const atOrBelow = means.filter((m) => m <= 0).length / means.length;
  if (sided === 'greater') return atOrBelow;
  const atOrAbove = means.filter((m) => m >= 0).length / means.length;
  return Math.min(1, 2 * Math.min(atOrBelow, atOrAbove));
}

// Holm's step-down procedure, in the order the p-values are given.
export function holm(ps, alpha = ALPHA) {
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const out = [];
  let running = 0;
  let stopped = false;
  order.forEach(({ p, i }, rank) => {
    const k = ps.length - rank;
    running = Math.max(running, Math.min(1, p * k));
    stopped = stopped || p > alpha / k;
    out[i] = { p, adjusted: running, rejected: !stopped };
  });
  return out;
}

const totalTokens = (r) => (r.tokens ? r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite : null);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function byTask(runs, value) {
  const out = new Map();
  for (const r of runs) {
    const v = value(r);
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (!out.has(r.task)) out.set(r.task, { B: [], C: [] });
    out.get(r.task)[r.arm]?.push(v);
  }
  return [...out.values()].filter((t) => t.B.length > 0 && t.C.length > 0);
}

export function tokensTest(primaryRuns, options) {
  const logRatios = byTask(primaryRuns, totalTokens)
    .map((t) => [median(t.C), median(t.B)])
    .filter(([c, b]) => c > 0 && b > 0)
    .map(([c, b]) => Math.log(c) - Math.log(b));
  const b = bootstrapMean(logRatios, options);
  const exp = (x) => (x === null ? null : Math.exp(x));
  return { tasks: logRatios.length, ratio: exp(b.mean), low: exp(b.low), high: exp(b.high), p: bootstrapP(logRatios, { sided: 'two', ...options }) };
}

function partialCredit(s2Runs, options) {
  const share = (r) => r.partial_credit?.share;
  const perArm = Object.fromEntries(ARMS.map((arm) => {
    const shares = s2Runs.filter((r) => r.arm === arm).map(share).filter((s) => typeof s === 'number');
    return [arm, { runs: shares.length, meanShare: shares.length ? mean(shares) : null }];
  }));
  const paired = bootstrapMean(byTask(s2Runs, share).map((t) => mean(t.C) - mean(t.B)), options);
  return { perArm, paired };
}

// records: run records; tasks: [{ id, stratum }].
export function analyzeStudy2(records, { tasks, resamples = 10000, seed = 1 }) {
  const options = { resamples, seed };
  const stratumOf = new Map(tasks.map((t) => [t.id, t.stratum]));
  const typed = records.map((r) => ({ ...r, task_type: stratumOf.get(r.task) === 'S4' ? 'decoy' : 'fix', task_category: stratumOf.get(r.task) }));
  const base = analyze(typed, { arms: ARMS, resamples, seed, fullRuns: FULL_RUNS });
  const scored = finalRecords(typed).filter((r) => !r.error && r.success !== null && r.success !== undefined);
  const primaryRuns = scored.filter((r) => r.task_type !== 'decoy');

  const cb = base.primary['C-B'];
  const differences = base.perTask.filter((t) => t.type !== 'decoy' && t.B !== null && t.C !== null).map((t) => t.C - t.B);
  const h1 = { tasks: differences.length, mean: cb.mean, lowerOneSided: cb.lowerOneSided, p: bootstrapP(differences, { sided: 'greater', ...options }) };
  const h2 = tokensTest(primaryRuns, options);
  const corrected = holm([h1.p ?? 1, h2.p ?? 1]).map((h, i) => ({ test: ['H1', 'H2'][i], ...h }));
  return {
    ...base,
    h1,
    h2,
    holm: corrected,
    verdict: {
      h1Supported: corrected[0].rejected,
      h2Rejected: corrected[1].rejected,
      killLine: cb.mean === null || cb.mean < KILL_POINTS || cb.lowerOneSided <= 0,
    },
    partialCredit: partialCredit(scored.filter((r) => stratumOf.get(r.task) === 'S2'), options),
  };
}
