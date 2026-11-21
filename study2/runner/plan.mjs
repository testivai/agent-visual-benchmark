// Study 2's plans (study2/PREREGISTRATION.md, sections 7 and 8): the pilot is
// one site drawn by a seed and two tasks of each stratum from it, drawn by the
// seed; the full study is every task. Each task runs in B and C, three times,
// in an order shuffled by a seed (study 1's buildPlan). The seeds and the task
// set are written at the freeze; until then there is no plan.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { buildPlan } from '../../runner/plan.mjs';
import { mulberry32, shuffle } from '../../runner/rng.mjs';

const STRATA = ['S1', 'S2', 'S3', 'S4'];

function requireSeed(config, name) {
  const value = config.seeds?.[name];
  if (!Number.isInteger(value)) throw new Error(`seeds.${name} is not set: study 2's seeds are written in study2/PREREGISTRATION.md at the freeze`);
  return value;
}

export function pilotTasks(tasks, { seed, perStratum }) {
  const random = mulberry32(seed);
  const sites = [...new Set(tasks.map((t) => t.site))].sort();
  const site = sites[Math.floor(random() * sites.length)];
  return STRATA.flatMap((k) => {
    const ids = tasks.filter((t) => t.site === site && t.stratum === k).map((t) => t.id).sort();
    if (ids.length < perStratum) throw new Error(`${site} has ${ids.length} ${k} tasks, the pilot takes ${perStratum}`);
    return shuffle(ids, Math.floor(random() * 2 ** 32)).slice(0, perStratum);
  });
}

// rung: the ladder rung the task set was generated at. Above 0, the run ids
// carry it (pilot-r1-001), so a later pilot's runs never mix with an earlier one's.
export function studyTwoPlan({ tasks, config, phase, rung = 0 }) {
  const seed = requireSeed(config, 'order');
  const taskIds = phase === 'pilot'
    ? pilotTasks(tasks, { seed: requireSeed(config, 'pilot'), perStratum: config.pilot.perStratum })
    : tasks.map((t) => t.id);
  const plan = buildPlan({ phase, taskIds, arms: config.arms, repeats: config.repeats[phase], seed });
  if (rung === 0) return plan;
  return { ...plan, rung, runs: plan.runs.map((r) => ({ ...r, runId: r.runId.replace(`${phase}-`, `${phase}-r${rung}-`) })) };
}

// The config and the task set generated with its seed.
export function loadStudyTwo({ configFile = path.join('study2', 'study.config.json'), root = REPO_ROOT } = {}) {
  const config = JSON.parse(fs.readFileSync(path.resolve(root, configFile), 'utf8'));
  const generation = requireSeed(config, 'generation');
  const file = path.resolve(root, config.tasksFile);
  if (!fs.existsSync(file)) throw new Error(`no task set at ${config.tasksFile}: it is generated with seeds.generation after the freeze`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.seed !== generation) throw new Error(`${config.tasksFile} was generated with seed ${record.seed}, not seeds.generation (${generation})`);
  return { config, tasks: record.tasks, rung: record.rung ?? 0 };
}
