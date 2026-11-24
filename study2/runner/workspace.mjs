// The directory an agent works in for a study 2 task: the template's site,
// server, arm files and baselines (clean or drifted, as the task's stratum
// says), the task's mutations in the stylesheet, the instructions, one git
// commit, then the installed packages. Study 1's commit and checks are reused,
// so the same rules hold: nothing from the benchmark goes in.
import fs from 'node:fs';
import path from 'node:path';
import { applyMutations } from '../mutate.mjs';
import { initRepo, finishWorkspace } from '../../runner/workspace.mjs';
import { instructionsFor, CSS_FILE } from './arms.mjs';

// Left out of the copy: packages come after the commit; the rest is the build's.
const SKIP = new Set(['node_modules', '.template.json', 'test-results', 'playwright-report', 'visual-report', '.testivai/temp']);

// The seeded stylesheet; every mutation must still find the value it recorded.
export function seededCss(css, mutations) {
  for (const m of mutations) {
    const now = css.slice(m.valueStart, m.valueEnd);
    if (now !== m.from) throw new Error(`${m.selector} ${m.property} is "${now}" in the stylesheet, not "${m.from}" as recorded`);
  }
  return applyMutations(css, mutations);
}

// runDir: a fresh run directory (rundir.mjs); the workspace is runDir/project.
export function buildTaskWorkspace({ task, arm, templateDir, runDir, benchRoot }) {
  const ws = path.join(runDir, 'project');
  fs.cpSync(templateDir, ws, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => !SKIP.has(path.relative(templateDir, src).split(path.sep).join('/')),
  });
  const css = path.join(ws, CSS_FILE);
  fs.writeFileSync(css, seededCss(fs.readFileSync(css, 'utf8'), task.mutations));
  fs.writeFileSync(path.join(ws, 'CLAUDE.md'), instructionsFor(arm));
  initRepo(ws);
  return finishWorkspace(ws, { arm, benchRoot, templateDir });
}
