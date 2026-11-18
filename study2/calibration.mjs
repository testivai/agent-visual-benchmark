// Study 2's pilot calibration (study2/PREREGISTRATION.md, sections 6 and 7).
// Arm-blind: it reports the pooled success of B and C together on S1 to S3,
// the ladder decision that follows, the cost per run, and the spread (SD) of
// the per-task C − B difference that the power rule needs. It never computes a
// per-arm rate or the mean difference, and a test checks that swapping the
// arms' labels changes nothing in what it returns.
import { finalRecords, median } from '../analysis/stats.mjs';

export const LADDER = [
  { rung: 1, what: 'two mutations per S1 task, three in S2' },
  { rung: 2, what: 'smaller value changes (lengths scaled by 0.8 or 1.2)' },
  { rung: 3, what: 'mutations only on elements below the first screen' },
];

const HARDER_ABOVE = 0.85;
const EASIER_BELOW = 0.40;
const PRIMARY = new Set(['S1', 'S2', 'S3']);

// --- power (section 6): one-sided at 5%, a true difference of 10 points ----------

const Z95 = 1.6448536269514722;
const Z80 = 0.8416212335729143;
const DIFFERENCE = 0.10;
const BASE_TASKS = 60;
const MAX_TASKS = 120;

// Abramowitz and Stegun 7.1.26 (error below 1.5e-7).
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normalCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

export function powerAt(sd, tasks) {
  if (sd === 0) return 1;
  return normalCdf((DIFFERENCE * Math.sqrt(tasks)) / sd - Z95);
}

// The S1 to S3 task count by the rule: 60 if that gives 80% power; otherwise
// the same number added to each of the three strata until it does, up to 120.
export function tasksFor(sd) {
  if (powerAt(sd, BASE_TASKS) >= 0.8) return BASE_TASKS;
  const needed = Math.ceil(((Z95 + Z80) * sd / DIFFERENCE) ** 2);
  return Math.min(MAX_TASKS, Math.ceil(needed / 3) * 3);
}

// --- the pilot ----------------------------------------------------------------

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function sampleSd(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

// Per S1 to S3 task with runs in both arms: the difference of the two arms' rates.
// Only its spread leaves this module.
function perTaskDifferences(runs) {
  const byTask = new Map();
  for (const r of runs) {
    if (!byTask.has(r.task)) byTask.set(r.task, { B: [], C: [] });
    byTask.get(r.task)[r.arm]?.push(r.success ? 1 : 0);
  }
  return [...byTask.values()].filter((t) => t.B.length > 0 && t.C.length > 0).map((t) => mean(t.C) - mean(t.B));
}

function nextRung(decision, rung) {
  if (decision === 'harder') {
    const next = LADDER.find((r) => r.rung === rung + 1);
    return next ? { next, note: null } : { next: null, note: 'no rung above the last: the maintainer decides' };
  }
  if (decision === 'easier') {
    if (rung <= 0) return { next: null, note: 'no rung below the start: the draft defines none, so the maintainer decides' };
    return { next: LADDER.find((r) => r.rung === rung - 1) ?? { rung: 0, what: 'the tasks as first drafted' }, note: null };
  }
  return { next: null, note: null };
}

function decide(rate) {
  if (rate === null) return 'keep';
  if (rate > HARDER_ABOVE) return 'harder';
  return rate < EASIER_BELOW ? 'easier' : 'keep';
}

// records: run records (the last attempt of each run counts); tasks: [{ id, stratum }];
// rung: the ladder rung the pilot ran at (0 = as drafted).
export function calibrate(records, { tasks, rung = 0 }) {
  const stratumOf = new Map(tasks.map((t) => [t.id, t.stratum]));
  const final = finalRecords(records);
  const scored = final.filter((r) => !r.error);
  const primary = scored.filter((r) => PRIMARY.has(stratumOf.get(r.task)) && (r.arm === 'B' || r.arm === 'C'));
  const successes = primary.filter((r) => r.success).length;
  const rate = primary.length === 0 ? null : successes / primary.length;
  const decision = decide(rate);
  const differences = perTaskDifferences(primary);
  const sd = sampleSd(differences);
  return {
    runs: final.length,
    errors: final.length - scored.length,
    pooled: { successes, runs: primary.length, rate },
    decision,
    ...nextRung(decision, rung),
    costPerRun: median(scored.map((r) => r.cost_usd).filter((c) => typeof c === 'number')),
    spread: {
      sd,
      tasks: differences.length,
      powerAt60: sd === null ? null : powerAt(sd, BASE_TASKS),
      tasksNeeded: sd === null ? null : tasksFor(sd),
    },
  };
}
