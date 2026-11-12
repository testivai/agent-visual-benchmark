// The directory an agent works in: the clean app with the task's seed, the
// arm's files and baselines, its instructions, one git commit. Nothing from
// the benchmark itself goes in, and checkWorkspace proves it before each run.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyApp, applyPatch } from '../harness/workspace.mjs';
import { armFilesDir, BASELINE_DIRS, instructionsFor } from './arms.mjs';

const GITIGNORE = ['node_modules/', 'test-results/', 'playwright-report/', 'visual-report/', '.testivai/temp/', ''].join('\n');

const FORBIDDEN_TOP = ['oracle', 'tasks', 'harness', 'tools', 'runner', 'analysis', 'arms', 'results', '.work', '.cache', '.claude',
  'TASKS.md', 'PREREGISTRATION.md', 'BUDGET.md', 'CHANGES_AFTER_PILOT.md', 'RUNNING.md', 'bench.config.json', 'runner.config.json'];
const FORBIDDEN_TEXT = ['agent-visual-benchmark', 'oracle', 'reference.patch', 'seed.patch', 'wrong.patch'];
const TEXT_FILE = /\.(?:html?|css|m?js|ts|json|md|txt|svg|yml|yaml)$/i;
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

function walk(root, skip = ['node_modules', '.git']) {
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(`${path.relative(root, full)}/`);
        visit(full);
      } else {
        out.push(path.relative(root, full));
      }
    }
  };
  visit(root);
  return out.map((p) => p.split(path.sep).join('/'));
}

const exists = (ws, rel) => fs.existsSync(path.join(ws, rel));

function armProblems(ws, arm, entries) {
  const problems = [];
  const snapshots = entries.some((e) => /-snapshots\/$/.test(e));
  const testivai = exists(ws, '.testivai') || exists(ws, 'node_modules/@testivai');
  if (arm === 'A' && exists(ws, 'tests/visual.spec.ts')) problems.push('arm A must not have tests/visual.spec.ts');
  if (arm !== 'B' && snapshots) problems.push(`arm ${arm} must not have screenshot baselines (*-snapshots/)`);
  if (arm !== 'C' && testivai) problems.push(`arm ${arm} must not have .testivai or @testivai packages`);
  if (arm !== 'A' && !exists(ws, 'tests/visual.spec.ts')) problems.push(`arm ${arm} is missing tests/visual.spec.ts`);
  if (arm === 'B' && !snapshots) problems.push('arm B is missing its screenshot baselines');
  if (arm === 'C' && !exists(ws, '.testivai/baselines')) problems.push('arm C is missing .testivai/baselines');
  return problems;
}

function textProblems(ws, entries, benchRoot) {
  const problems = [];
  const needles = [...FORBIDDEN_TEXT, ...(benchRoot ? [benchRoot] : [])];
  for (const rel of entries.filter((e) => !e.endsWith('/') && TEXT_FILE.test(e))) {
    const full = path.join(ws, rel);
    if (fs.statSync(full).size > MAX_SCAN_BYTES) continue;
    const text = fs.readFileSync(full, 'utf8');
    const hit = needles.find((n) => text.includes(n));
    if (hit) problems.push(`${rel} mentions "${hit}"`);
  }
  return problems;
}

// Every symbolic link, node_modules included, must lead to a place inside the workspace.
function linkProblems(ws) {
  const problems = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
        if (target !== ws && !target.startsWith(ws + path.sep)) {
          problems.push(`${path.relative(ws, full).split(path.sep).join('/')} is a link to ${target}, outside the workspace`);
        }
      } else if (entry.isDirectory()) {
        visit(full);
      }
    }
  };
  visit(ws);
  return problems;
}

function gitProblems(ws) {
  try {
    const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: ws, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(ws) },
    }).trim();
    return count === '1' ? [] : [`the workspace has ${count} commits, must have one`];
  } catch {
    return ['the workspace is not a git repository with one commit'];
  }
}

export function checkWorkspace(ws, { arm, benchRoot, requireGit = true }) {
  const entries = walk(ws);
  const problems = [];
  for (const name of FORBIDDEN_TOP) {
    if (exists(ws, name)) problems.push(`${name} must not be in the workspace`);
  }
  for (const e of entries) {
    if (/(^|\/)oracle\/$/.test(e)) problems.push(`${e} must not be in the workspace`);
    if (e.endsWith('.patch')) problems.push(`${e}: no patch file may be in the workspace`);
  }
  problems.push(...armProblems(ws, arm, entries));
  problems.push(...textProblems(ws, entries, benchRoot));
  problems.push(...linkProblems(ws));
  if (requireGit) problems.push(...gitProblems(ws));
  return problems;
}

function git(ws, args) {
  execFileSync('git', [
    '-c', 'user.name=Acme Developer', '-c', 'user.email=dev@acme.example', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=/dev/null', '-c', 'init.defaultBranch=main', ...args,
  ], { cwd: ws, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(ws) } });
}

function copyInto(fromRoot, toRoot, rel) {
  const from = path.join(fromRoot, rel);
  // verbatimSymlinks: keep npm's relative links relative (by default Node makes them absolute)
  if (fs.existsSync(from)) fs.cpSync(from, path.join(toRoot, rel), { recursive: true, verbatimSymlinks: true });
}

// runDir is a fresh temporary directory; the workspace is runDir/project, a
// name that says nothing about the task or the arm.
export function buildWorkspace({ benchRoot, taskId, arm, templateDir, runDir }) {
  const ws = path.join(runDir, 'project');
  copyApp(path.join(benchRoot, 'app'), ws);
  applyPatch(ws, path.join(benchRoot, 'tasks', taskId, 'seed.patch'));
  fs.cpSync(armFilesDir(arm), ws, { recursive: true });
  for (const dir of BASELINE_DIRS[arm]) copyInto(templateDir, ws, dir);
  fs.writeFileSync(path.join(ws, 'CLAUDE.md'), instructionsFor(arm));
  fs.writeFileSync(path.join(ws, '.gitignore'), GITIGNORE);
  git(ws, ['init', '-q']);
  // the same list, kept where deleting .gitignore cannot remove it
  fs.writeFileSync(path.join(ws, '.git', 'info', 'exclude'), GITIGNORE);
  git(ws, ['add', '-A']);
  git(ws, ['commit', '-q', '-m', 'Initial commit', '--date', '2026-01-05T10:00:00Z']);
  copyInto(templateDir, ws, 'node_modules');
  const problems = checkWorkspace(ws, { arm, benchRoot });
  if (problems.length > 0) throw new Error(`workspace check failed:\n- ${problems.join('\n- ')}`);
  return ws;
}
