// What makes a run a study 2 run, for the runner (runner/study1.mjs has study
// 1's): the task from the generated set, the one prompt, the template for the
// task's site, arm and baselines (drifted in S3 and S4, with the setting in
// study2/drift.json), the workspace with the task's mutations, and the scorer.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { DRIFT_SETTINGS } from '../drift.mjs';
import { PROMPT } from './arms.mjs';
import { ensureSiteTemplate } from './templates.mjs';
import { buildTaskWorkspace } from './workspace.mjs';
import { scoreTaskWorkspace } from './score.mjs';

function chosenDrift() {
  const { chosen } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'study2', 'drift.json'), 'utf8'));
  const setting = DRIFT_SETTINGS.find((s) => s.name === chosen);
  if (!setting) throw new Error(`study2/drift.json names no known setting (${chosen})`);
  return setting;
}

// tasks: the generated tasks ({ id, stratum, site, drift, mutations }).
export function studyTwo({ tasks, drift = chosenDrift() }) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const taskOf = (run) => {
    const t = byId.get(run.task);
    if (!t) throw new Error(`no study 2 task ${run.task}`);
    return t;
  };
  const baselines = (t) => (t.drift ? drift : null);
  return {
    name: 'study2',
    drift,
    task: ({ run }) => {
      const t = taskOf(run);
      return { id: t.id, prompt: PROMPT, type: t.mutations.length === 0 ? 'decoy' : 'fix', category: t.stratum };
    },
    templateKey: (run) => {
      const t = taskOf(run);
      return `${t.site}/${run.arm}/${t.drift ? drift.name : 'clean'}`;
    },
    template: ({ benchRoot, run, log }) => {
      const t = taskOf(run);
      return ensureSiteTemplate({ site: t.site, arm: run.arm, drift: baselines(t), cacheRoot: path.join(benchRoot, '.cache', 'runner'), log });
    },
    workspace: ({ benchRoot, run, templateDir, runDir }) => buildTaskWorkspace({ task: taskOf(run), arm: run.arm, templateDir, runDir, benchRoot }),
    score: ({ run, ws }) => scoreTaskWorkspace({ task: taskOf(run), ws }),
    recordFields: (scored, run) => {
      const t = taskOf(run);
      return { site: t.site, stratum: t.stratum, drift: t.drift, partial_credit: scored.partial, site_files: scored.siteFilesChanged, measured: scored.measured };
    },
  };
}
