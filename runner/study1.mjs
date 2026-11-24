// What makes a run a study 1 run: its task file, its template (one per arm),
// its workspace (the app with seed.patch) and its scorer (the hidden oracle's
// specs). Another study passes its own object as context.study (study 2:
// study2/runner/study.mjs); a run without one is a study 1 run.
import fs from 'node:fs';
import path from 'node:path';
import { buildWorkspace } from './workspace.mjs';
import { scoreWorkspace } from './score.mjs';
import { ensureTemplate } from './templates.mjs';

export const STUDY1 = {
  name: 'study1',
  task: ({ benchRoot, run }) => JSON.parse(fs.readFileSync(path.join(benchRoot, 'tasks', run.task, 'task.json'), 'utf8')),
  templateKey: (run) => run.arm,
  template: ({ benchRoot, run, log }) => ensureTemplate({ benchRoot, arm: run.arm, cacheRoot: path.join(benchRoot, '.cache', 'runner'), log }),
  workspace: ({ benchRoot, run, templateDir, runDir }) => buildWorkspace({ benchRoot, taskId: run.task, arm: run.arm, templateDir, runDir }),
  score: ({ benchRoot, run, ws }) => scoreWorkspace({ benchRoot, taskId: run.task, ws }),
  recordFields: () => ({}),
};
