// Description of study 2 beyond the preregistered tests (study2/PREREGISTRATION.md,
// section 6, "Description only"). Nothing here is a test of H1 or H2, and none of it
// carries a p-value.
// - tokensByStratum: H2's measure (C's tokens over B's, the per-task median, paired,
//   on a log scale) for each stratum on its own, with its bootstrap interval;
// - calibration: the pilot's own measures (study2/calibration.mjs), pooled success
//   over S1 to S3 and the per-task SD of C − B, taken on these runs, so the full
//   study can be set beside the pilot that sized it;
// - generationChecks: of the drawn candidates with a measured, visible change,
//   how many each arm's comparator flags (the validity filter keeps those both flag).
import { finalRecords } from '../analysis/stats.mjs';
import { tokensTest } from './analysis.mjs';
import { calibrate } from './calibration.mjs';

const STRATA = ['S1', 'S2', 'S3', 'S4'];

// records: run records; tasks: [{ id, stratum }].
export function describeStudy2(records, { tasks, resamples = 10000, seed = 1 }) {
  const stratumOf = new Map(tasks.map((t) => [t.id, t.stratum]));
  const scored = finalRecords(records).filter((r) => !r.error && r.success !== null && r.success !== undefined);
  const tokensByStratum = {};
  for (const stratum of STRATA) {
    const runs = scored.filter((r) => stratumOf.get(r.task) === stratum);
    if (runs.length > 0) tokensByStratum[stratum] = tokensTest(runs, { resamples, seed });
  }
  const { pooled, spread } = calibrate(records, { tasks });
  return { tokensByStratum, calibration: { pooled, spread } };
}

const ONLY_TESTIVAI = "arm B's check (Playwright) does not flag it";
const ONLY_PLAYWRIGHT = "arm C's check (TestivAI) does not flag it";
const NEITHER = "neither arm's check flags it";
const TOGETHER = 'does not show together with the others';

// stats: a generated task set's drawStats (study2/generate.mjs). A mutation dropped
// because it did not show together with its task's others had shown on its own,
// so both comparators had flagged it.
export function generationChecks(stats) {
  const rejected = (reason) => Object.values(stats.byClass).reduce((n, c) => n + (c.rejected[reason] ?? 0), 0);
  const both = stats.kept + rejected(TOGETHER);
  const onlyTestivai = rejected(ONLY_TESTIVAI);
  const onlyPlaywright = rejected(ONLY_PLAYWRIGHT);
  const neither = rejected(NEITHER);
  return {
    candidates: stats.candidates,
    kept: stats.kept,
    visible: both + onlyTestivai + onlyPlaywright + neither,
    both,
    onlyTestivai,
    onlyPlaywright,
    neither,
    playwright: both + onlyPlaywright,
    testivai: both + onlyTestivai,
  };
}
