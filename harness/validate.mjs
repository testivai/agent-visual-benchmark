#!/usr/bin/env node
// npm run validate: proves every task behaves before it is used.
//
// For each task, on throw-away copies of the app:
//   seed       score.spec must FAIL (decoy: pass), collateral.spec and the functional suite pass
//   reference  score.spec, collateral.spec and the functional suite PASS
//   wrong      at least one of score.spec and collateral.spec FAILS
// plus static checks on the task's files and prompt. Exits 1 if any task misbehaves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, makeWorkspace, removeWorkspace, listFiles } from './workspace.mjs';
import { runOracleSpecs, runFunctional } from './run-specs.mjs';
import { checkTaskOutcomes } from './rules.mjs';
import { lintTask, lintTaskSet, ORACLE_FILES } from './lint.mjs';

const TEXT_FILE = /\.(?:html?|css|m?js|ts|json|md|svg|txt|patch)$/i;

export function loadConfig(benchRoot) {
  return JSON.parse(fs.readFileSync(path.join(benchRoot, 'bench.config.json'), 'utf8'));
}

const readIfExists = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const filesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort() : []);

export function loadTasks(benchRoot) {
  const tasksDir = path.join(benchRoot, 'tasks');
  return fs.readdirSync(tasksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((id) => {
      const dir = path.join(tasksDir, id);
      const oracleDir = path.join(benchRoot, 'oracle', id);
      const taskJson = readIfExists(path.join(dir, 'task.json'));
      return {
        id,
        dir,
        oracleDir,
        task: taskJson ? JSON.parse(taskJson) : {},
        taskFiles: filesIn(dir),
        oracleFiles: filesIn(oracleDir),
        seedPatch: readIfExists(path.join(dir, 'seed.patch')),
      };
    });
}

export function acceptedPatches(oracleDir) {
  return filesIn(path.join(oracleDir, 'accepted')).filter((f) => f.endsWith('.patch'));
}

// state name -> the patches that make it, applied in order to the clean app
function statesOf(t) {
  const seed = path.join(t.dir, 'seed.patch');
  const states = {
    seed: [seed],
    reference: [seed, path.join(t.oracleDir, 'reference.patch')],
    wrong: [seed, path.join(t.oracleDir, 'wrong.patch')],
  };
  for (const name of acceptedPatches(t.oracleDir)) {
    states[`accepted/${name}`] = [seed, path.join(t.oracleDir, 'accepted', name)];
  }
  return states;
}

async function measureState(benchRoot, t, state, patches, keep) {
  const ws = makeWorkspace({ appDir: path.join(benchRoot, 'app'), patches, label: 'validate' });
  try {
    const score = path.join(t.oracleDir, 'score.spec.ts');
    const collateral = path.join(t.oracleDir, 'collateral.spec.ts');
    const oracle = await runOracleSpecs({ benchRoot, appDir: ws, specs: [score, collateral] });
    const outcome = { score: oracle[score].status, collateral: oracle[collateral].status };
    const detail = { score: oracle[score].failures, collateral: oracle[collateral].failures };
    if (state !== 'wrong') {
      const functional = await runFunctional({ appDir: ws });
      outcome.functional = functional.status;
      detail.functional = functional.failures;
    }
    return { outcome, detail };
  } finally {
    if (!keep) removeWorkspace(ws);
  }
}

async function validateTask(benchRoot, t, config, keep) {
  const problems = lintTask(t, config);
  const result = { id: t.id, type: t.task.type, category: t.task.category, problems, outcomes: {}, details: {} };
  if (ORACLE_FILES.some((f) => !t.oracleFiles.includes(f)) || !t.taskFiles.includes('seed.patch')) return result;
  for (const [state, patches] of Object.entries(statesOf(t))) {
    try {
      const { outcome, detail } = await measureState(benchRoot, t, state, patches, keep);
      result.outcomes[state] = outcome;
      result.details[state] = detail;
    } catch (err) {
      problems.push(`${state}: ${err.message}`);
      return result;
    }
  }
  const { seed, reference, wrong, ...rest } = result.outcomes;
  const accepted = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k.replace(/^accepted\//, ''), v]));
  problems.push(...checkTaskOutcomes({ type: t.task.type, seed, reference, wrong, accepted }));
  return result;
}

function bannedTextProblems(benchRoot, config) {
  const problems = [];
  for (const top of ['app', 'tasks']) {
    for (const rel of listFiles(path.join(benchRoot, top))) {
      if (!TEXT_FILE.test(rel)) continue;
      const text = fs.readFileSync(path.join(benchRoot, top, rel), 'utf8').toLowerCase();
      for (const banned of config.bannedText ?? []) {
        if (text.includes(banned.toLowerCase())) problems.push(`${top}/${rel} mentions "${banned}"`);
      }
    }
  }
  return problems;
}

async function cleanAppProblems(benchRoot) {
  const ws = makeWorkspace({ appDir: path.join(benchRoot, 'app'), patches: [], label: 'validate' });
  try {
    const functional = await runFunctional({ appDir: ws });
    if (functional.status === 'passed') return [];
    const why = functional.failures.map((f) => `${f.title}: ${f.message.split('\n')[0]}`).join('; ');
    return [`the clean app's functional suite must pass, but it ${functional.status} (${why})`];
  } finally {
    removeWorkspace(ws);
  }
}

async function pool(items, jobs, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, run));
  return results;
}

export async function validateBench({ benchRoot = REPO_ROOT, only, jobs, keep = false, log = () => {} } = {}) {
  const root = path.resolve(benchRoot);
  const config = loadConfig(root);
  const all = loadTasks(root);
  const unknown = (only ?? []).filter((id) => !all.some((t) => t.id === id));
  if (unknown.length > 0) throw new Error(`unknown task: ${unknown.join(', ')}`);
  const tasks = only ? all.filter((t) => only.includes(t.id)) : all;

  const setProblems = [
    ...(only ? [] : lintTaskSet(all, config)),
    ...bannedTextProblems(root, config),
    ...(await cleanAppProblems(root)),
  ];
  const results = await pool(tasks, jobs ?? Math.max(1, os.availableParallelism() - 1), async (t) => {
    const r = await validateTask(root, t, config, keep);
    log(r);
    return r;
  });
  return { ok: setProblems.length === 0 && results.every((r) => r.problems.length === 0), setProblems, tasks: results };
}

function printTask(r) {
  const mark = r.problems.length === 0 ? 'ok  ' : 'FAIL';
  console.log(`${mark} ${r.id}  ${r.type ?? '?'} / ${r.category ?? '?'}`);
  for (const problem of r.problems) console.log(`       - ${problem}`);
  if (r.problems.length === 0) return;
  for (const [state, detail] of Object.entries(r.details)) {
    for (const [spec, failures] of Object.entries(detail)) {
      for (const f of failures.slice(0, 3)) {
        console.log(`         [${state} ${spec}] ${f.title}: ${f.message.split('\n').slice(0, 4).join(' | ').slice(0, 400)}`);
      }
    }
  }
}

function parseArgs(argv) {
  const args = { benchRoot: REPO_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.benchRoot = argv[++i];
    else if (a === '--task') args.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--jobs') args.jobs = Number(argv[++i]);
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--keep') args.keep = true;
    else throw new Error(`unknown option ${a}`);
  }
  return args;
}

async function main() {
  let args;
  let result;
  try {
    args = parseArgs(process.argv.slice(2));
    result = await validateBench({ ...args, log: printTask });
  } catch (err) {
    console.error(`validate: ${err.message}`);
    process.exit(2);
  }
  for (const problem of result.setProblems) console.log(`FAIL set  - ${problem}`);
  const valid = result.tasks.filter((r) => r.problems.length === 0).length;
  console.log(`\n${valid} of ${result.tasks.length} tasks valid${result.setProblems.length ? `, ${result.setProblems.length} problem(s) with the set` : ''}`);
  if (args.json) fs.writeFileSync(args.json, `${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
