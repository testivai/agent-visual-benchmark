import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, calibrate, powerAt, tasksFor } from './calibration.mjs';

test('power, one-sided at 5%, for a true 10-point difference: the table in section 6', () => {
  assert.equal(Math.round(powerAt(0.2, 60) * 100), 99);
  assert.equal(Math.round(powerAt(0.3, 60) * 100), 83);
  assert.equal(Math.round(powerAt(0.4, 60) * 100), 61);
});

test('the power rule: 60 tasks if that reaches 80%; else equal additions to S1 to S3, up to 120', () => {
  assert.equal(tasksFor(0.2), 60);
  assert.equal(tasksFor(0.3), 60, '83% at 60');
  assert.equal(tasksFor(0.35), 78, 'needs 76: the next multiple of 3');
  assert.ok(powerAt(0.35, 78) >= 0.8 && powerAt(0.35, 75) < 0.8);
  assert.equal(tasksFor(0.6), 120, 'capped');
});

test('the ladder: three rungs, in the published order', () => {
  assert.deepEqual(LADDER.map((r) => r.rung), [1, 2, 3]);
  assert.match(LADDER[0].what, /two mutations per S1 task, three in S2/);
  assert.match(LADDER[1].what, /0\.8 or 1\.2/);
  assert.match(LADDER[2].what, /below the first screen/);
});

const TASKS = [
  { id: 't1', stratum: 'S1' }, { id: 't2', stratum: 'S2' }, { id: 't3', stratum: 'S3' }, { id: 't4', stratum: 'S4' },
];
// success per (task, arm): a list of outcomes for the repeats; null is a run that errored
function records(table) {
  const out = [];
  for (const [task, arms] of Object.entries(table)) {
    for (const [arm, outcomes] of Object.entries(arms)) {
      outcomes.forEach((o, i) => out.push({
        run_id: `${task}-${arm}-${i}`, task, arm, repeat: i + 1,
        success: o, error: o === null ? 'boom' : null, cost_usd: 0.1,
      }));
    }
  }
  return out;
}
const swap = (rs) => rs.map((r) => ({ ...r, arm: { B: 'C', C: 'B' }[r.arm] ?? r.arm }));

const EASY = {
  t1: { B: [true, true, true], C: [true, true, true] },
  t2: { B: [true, true, false], C: [true, true, true] },
  t3: { B: [true, true, true], C: [true, false, true] },
  t4: { B: [false, false, false], C: [false, false, false] },
};

test('pooled over B and C on S1 to S3 only; above 85% the next rung up', () => {
  const r = calibrate(records(EASY), { tasks: TASKS, rung: 0 });
  assert.deepEqual(r.pooled, { successes: 16, runs: 18, rate: 16 / 18 });
  assert.equal(r.decision, 'harder');
  assert.equal(r.next.rung, 1);
  assert.equal(r.errors, 0);
  assert.equal(r.costPerRun, 0.1);
});

test('arm-blind: swapping the arms\' labels changes nothing in the result', () => {
  const r = calibrate(records(EASY), { tasks: TASKS, rung: 0 });
  assert.deepEqual(calibrate(swap(records(EASY)), { tasks: TASKS, rung: 0 }), r);
  const text = JSON.stringify(r);
  assert.ok(!/"(B|C)"/.test(text), `no per-arm key: ${text}`);
});

test('the spread: the SD over S1 to S3 tasks of C − B per task, with what it means for power', () => {
  const r = calibrate(records(EASY), { tasks: TASKS, rung: 0 });
  // per-task C − B: 0, 1/3, −1/3 -> SD 1/3
  assert.ok(Math.abs(r.spread.sd - 1 / 3) < 1e-12);
  assert.equal(r.spread.tasks, 3);
  assert.equal(r.spread.tasksNeeded, tasksFor(r.spread.sd));
});

test('below 40%: one rung down; there is nothing below the start, which is said, not invented', () => {
  const hard = {
    t1: { B: [false, false, false], C: [false, true, false] },
    t2: { B: [false, false, false], C: [false, false, false] },
    t3: { B: [true, false, false], C: [false, null, false] },
  };
  const r = calibrate(records(hard), { tasks: TASKS, rung: 0 });
  assert.equal(r.errors, 1);
  assert.deepEqual(r.pooled, { successes: 2, runs: 17, rate: 2 / 17 });
  assert.equal(r.decision, 'easier');
  assert.equal(r.next, null);
  assert.match(r.note, /no rung below the start/);
  assert.equal(calibrate(records(hard), { tasks: TASKS, rung: 2 }).next.rung, 1);
});

test('between 40% and 85%: the tasks stay as they are; a retried run counts once, by its last attempt', () => {
  const mid = { t1: { B: [true, false], C: [true, false] } };
  const rs = records(mid);
  const retried = [{ ...rs[1], success: null, error: 'first attempt failed' }, ...rs];
  const r = calibrate(retried, { tasks: TASKS, rung: 0 });
  assert.equal(r.decision, 'keep');
  assert.equal(r.next, null);
  assert.equal(r.pooled.runs, 4);
});
