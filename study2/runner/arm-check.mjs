// Does each arm's own visual test, run in a task's real workspace as the agent
// will run it, flag the task? The validity filter asked the arms' comparators
// about the oracle's screenshots; this asks the tools themselves, with their
// own screenshots, before the freeze. A run that ends without a verdict is an
// error, never "not flagged".
import fs from 'node:fs';
import path from 'node:path';
import { withTempDir } from '../../runner/tempdir.mjs';
import { buildTaskWorkspace } from './workspace.mjs';
import { asTheAgentRunsIt, summaryOf } from './templates.mjs';

function failedViews({ status, stdout }) {
  if (status === 0) return 0;
  const m = stdout.match(/(\d+) failed/);
  if (!m) throw new Error(`the visual test ended (exit ${status}) without a verdict:\n${stdout.slice(-1500)}`);
  return Number(m[1]);
}

function changedViews(ws, r) {
  if (!fs.existsSync(path.join(ws, 'visual-report', 'results.json'))) throw new Error(`the visual test wrote no report (exit ${r.status}):\n${r.stdout.slice(-1500)}`);
  return summaryOf(ws).changed;
}

// -> { flagged, views }: how many views the arm's test flags.
export async function armTestFlags({ task, arm, templateDir, benchRoot }) {
  return withTempDir('avb-s2-armcheck-', async (runDir) => {
    const ws = buildTaskWorkspace({ task, arm, templateDir, runDir, benchRoot });
    const r = await asTheAgentRunsIt(ws);
    const views = arm === 'B' ? failedViews(r) : changedViews(ws, r);
    return { flagged: views > 0, views };
  });
}
