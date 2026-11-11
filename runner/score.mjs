// Scores a finished workspace with the hidden oracle. Only site/ is taken
// from the workspace: it is copied into a clean copy of the app, and the
// oracle and the functional suite run there, so nothing else the agent
// changed (tests, configs, packages) can affect the verdict.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyApp, WORK_ROOT, removeWorkspace } from '../harness/workspace.mjs';
import { runOracleSpecs, runFunctional } from '../harness/run-specs.mjs';

const MAX_DIFF_BYTES = 2 * 1024 * 1024;

function scoringCopy(benchRoot, ws) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const app = path.join(fs.mkdtempSync(path.join(WORK_ROOT, 'score-')), 'app');
  copyApp(path.join(benchRoot, 'app'), app);
  fs.rmSync(path.join(app, 'site'), { recursive: true, force: true });
  fs.cpSync(path.join(ws, 'site'), path.join(app, 'site'), { recursive: true, dereference: false });
  return app;
}

const short = (failures) => (failures ?? []).slice(0, 5).map((f) => `${f.title}: ${String(f.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)}`);

async function scoreOnce(benchRoot, taskId, ws) {
  const app = scoringCopy(benchRoot, ws);
  try {
    const score = path.join(benchRoot, 'oracle', taskId, 'score.spec.ts');
    const collateral = path.join(benchRoot, 'oracle', taskId, 'collateral.spec.ts');
    const oracle = await runOracleSpecs({ benchRoot, appDir: app, specs: [score, collateral] });
    const functional = await runFunctional({ appDir: app });
    return {
      score: oracle[score].status,
      collateral: oracle[collateral].status,
      functional: functional.status,
      failures: { score: short(oracle[score].failures), collateral: short(oracle[collateral].failures), functional: short(functional.failures) },
    };
  } finally {
    removeWorkspace(app);
  }
}

// A scorer error (no verdict) is retried once: it is the harness's problem, not the agent's.
export async function scoreWorkspace({ benchRoot, taskId, ws }) {
  const first = await scoreOnce(benchRoot, taskId, ws);
  if (![first.score, first.collateral].includes('error')) return first;
  return scoreOnce(benchRoot, taskId, ws);
}

// The agent's change, as a patch against the starting commit.
export function finalDiff(ws) {
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(ws) };
  const git = (args) => execFileSync('git', args, { cwd: ws, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  // outputs and node_modules are excluded by .git/info/exclude (written with the workspace)
  git(['add', '-A']);
  const patch = git(['diff', '--cached', '--binary', '--no-color', '--no-ext-diff', 'HEAD']);
  const numstat = git(['diff', '--cached', '--numstat', 'HEAD']).trim().split('\n').filter(Boolean);
  const stats = numstat.reduce((s, line) => {
    const [added, removed] = line.split('\t');
    return { files: s.files + 1, added: s.added + (Number(added) || 0), removed: s.removed + (Number(removed) || 0) };
  }, { files: 0, added: 0, removed: 0 });
  const text = patch.length > MAX_DIFF_BYTES ? `${patch.slice(0, MAX_DIFF_BYTES)}\n[truncated: the diff was ${patch.length} bytes]\n` : patch;
  return { text, stats };
}
