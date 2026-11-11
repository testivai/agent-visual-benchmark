// Which runs a phase makes, and in what order.
import { shuffle } from './rng.mjs';

// Both tasks of `fixCategories` fix categories, plus `change` change tasks and
// `decoy` decoys, all chosen at random from the seed. Returns sorted ids.
export function selectPilotTasks(tasks, { seed, fixCategories = 2, change = 1, decoy = 1 }) {
  const categories = [...new Set(tasks.filter((t) => t.type === 'fix').map((t) => t.category))].sort();
  const pickedCategories = shuffle(categories, seed).slice(0, fixCategories);
  const fix = tasks.filter((t) => t.type === 'fix' && pickedCategories.includes(t.category));
  const pick = (type, n, offset) => shuffle(tasks.filter((t) => t.type === type).map((t) => t.id).sort(), seed + offset).slice(0, n);
  return [...fix.map((t) => t.id), ...pick('change', change, 1), ...pick('decoy', decoy, 2)].sort();
}

// Every task x arm x repeat once, in an order shuffled from the seed, so that
// drift in the model service over time does not line up with one arm.
export function buildPlan({ phase, taskIds, arms, repeats, seed }) {
  const runs = [];
  for (const task of taskIds) {
    for (const arm of arms) {
      for (let repeat = 1; repeat <= repeats; repeat++) runs.push({ task, arm, repeat });
    }
  }
  return {
    phase,
    seed,
    runs: shuffle(runs, seed).map((r, i) => ({
      runId: `${phase}-${String(i + 1).padStart(3, '0')}`,
      order: i + 1,
      ...r,
    })),
  };
}
