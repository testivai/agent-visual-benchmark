import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, shuffle } from './rng.mjs';
import { selectPilotTasks, buildPlan } from './plan.mjs';

const TASKS = [
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((cat, i) => [
    { id: `f${i}1`, type: 'fix', category: cat },
    { id: `f${i}2`, type: 'fix', category: cat },
  ]),
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `c${i}`, type: 'change', category: 'shared-css' })),
  ...[1, 2, 3, 4].map((i) => ({ id: `d${i}`, type: 'decoy', category: 'no-defect' })),
];

test('the generator is deterministic for a seed and in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, mulberry32(43)));
});

test('shuffle is a permutation, deterministic for a seed, and does not touch its input', () => {
  const input = Array.from({ length: 50 }, (_, i) => i);
  const once = shuffle(input, 7);
  assert.deepEqual([...once].sort((x, y) => x - y), input);
  assert.deepEqual(shuffle(input, 7), once);
  assert.notDeepEqual(shuffle(input, 8), once);
  assert.deepEqual(input, Array.from({ length: 50 }, (_, i) => i));
});

test('the pilot takes both tasks of two fix categories, one change and one decoy', () => {
  const ids = selectPilotTasks(TASKS, { seed: 1 });
  const picked = TASKS.filter((t) => ids.includes(t.id));
  assert.equal(ids.length, 6);
  const fix = picked.filter((t) => t.type === 'fix');
  assert.equal(fix.length, 4);
  const cats = new Set(fix.map((t) => t.category));
  assert.equal(cats.size, 2);
  for (const c of cats) assert.equal(fix.filter((t) => t.category === c).length, 2);
  assert.equal(picked.filter((t) => t.type === 'change').length, 1);
  assert.equal(picked.filter((t) => t.type === 'decoy').length, 1);
  assert.deepEqual(ids, [...ids].sort());
});

test('the pilot selection is fixed by its seed', () => {
  assert.deepEqual(selectPilotTasks(TASKS, { seed: 99 }), selectPilotTasks(TASKS, { seed: 99 }));
  const seen = new Set(Array.from({ length: 20 }, (_, s) => selectPilotTasks(TASKS, { seed: s }).join(',')));
  assert.ok(seen.size > 5, 'different seeds pick different tasks');
});

test('a plan has every task x arm x repeat once, in a seeded random order', () => {
  const plan = buildPlan({ phase: 'pilot', taskIds: ['t1', 't2', 't3'], arms: ['A', 'B', 'C'], repeats: 3, seed: 5 });
  assert.equal(plan.runs.length, 27);
  assert.equal(plan.seed, 5);
  const keys = plan.runs.map((r) => `${r.task}/${r.arm}/${r.repeat}`);
  assert.equal(new Set(keys).size, 27);
  for (const arm of ['A', 'B', 'C']) assert.equal(plan.runs.filter((r) => r.arm === arm).length, 9);
  assert.deepEqual(plan.runs.map((r) => r.runId).slice(0, 3), ['pilot-001', 'pilot-002', 'pilot-003']);
  assert.deepEqual(plan.runs.map((r) => r.order), Array.from({ length: 27 }, (_, i) => i + 1));
  // shuffled: the first nine runs are not all one arm, and the order differs from the nested loops
  assert.notDeepEqual(keys, [...keys].sort());
  assert.deepEqual(buildPlan({ phase: 'pilot', taskIds: ['t1', 't2', 't3'], arms: ['A', 'B', 'C'], repeats: 3, seed: 5 }), plan);
});

test('the full study is 24 x 3 x 5 = 360 runs', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`);
  assert.equal(buildPlan({ phase: 'full', taskIds: ids, arms: ['A', 'B', 'C'], repeats: 5, seed: 1 }).runs.length, 360);
});

test('arms do not cluster: across the plan, each arm is spread over the whole order', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `t${i}`);
  const plan = buildPlan({ phase: 'full', taskIds: ids, arms: ['A', 'B', 'C'], repeats: 5, seed: 3 });
  for (const arm of ['A', 'B', 'C']) {
    const orders = plan.runs.filter((r) => r.arm === arm).map((r) => r.order);
    const mean = orders.reduce((s, x) => s + x, 0) / orders.length;
    assert.ok(Math.abs(mean - 180.5) < 30, `${arm} mean position ${mean}`);
  }
});
