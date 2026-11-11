#!/usr/bin/env node
// The study's command line. Commands that start a real agent spend money and
// go through the preflight check; `start` also goes through the budget gate.
//
//   node runner/run.mjs plan     --phase pilot|full   the runs, in order (free)
//   node runner/run.mjs prepare                       build the arm templates (free)
//   node runner/run.mjs check                         preflight checks (free)
//   node runner/run.mjs probe                         one short real run that tests the isolation
//   node runner/run.mjs dry-run  --phase pilot        one real run, to estimate cost
//   node runner/run.mjs start    --phase pilot [--confirm]
//   node runner/run.mjs status   --phase pilot
//
// Options: --config <file> (default runner.config.json), --results <dir>
// (default results/<phase>), --budget-file <file> (default BUDGET.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from '../harness/workspace.mjs';
import { loadConfig, validateConfig, configHash } from './config.mjs';
import { selectPilotTasks, buildPlan } from './plan.mjs';
import { preflight } from './preflight.mjs';
import { readBudget, gate, latestDryRun } from './budget.mjs';
import { executePlan, readRecords, finishedRuns } from './execute.mjs';
import { runOne } from './run-one.mjs';
import { ensureTemplate, browsersPath } from './templates.mjs';
import { armFilesDir } from './arms.mjs';
import { buildWorkspace } from './workspace.mjs';
import { buildSettings, buildClaudeArgs, buildAgentEnv } from './claude.mjs';
import { runAgent } from './agent.mjs';
import { parseStream } from './transcript.mjs';
import { secretValues } from './scrub.mjs';
import { freePort } from '../harness/run-specs.mjs';

const CACHE = path.join(REPO_ROOT, '.cache', 'runner');

function allTasks(benchRoot) {
  return fs.readdirSync(path.join(benchRoot, 'tasks')).sort()
    .map((id) => JSON.parse(fs.readFileSync(path.join(benchRoot, 'tasks', id, 'task.json'), 'utf8')));
}

export function planFor({ benchRoot, config, phase }) {
  const tasks = allTasks(benchRoot);
  const taskIds = phase === 'pilot'
    ? selectPilotTasks(tasks, { seed: config.seeds.pilotTasks, ...config.pilot })
    : tasks.map((t) => t.id);
  return buildPlan({ phase, taskIds, arms: config.arms, repeats: config.repeats[phase], seed: config.seeds.order });
}

function benchCommit(benchRoot) {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: benchRoot, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'app', 'tasks', 'oracle', 'arms', 'runner'], { cwd: benchRoot, encoding: 'utf8' }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

function packageVersions() {
  const pkg = JSON.parse(fs.readFileSync(path.join(armFilesDir('C'), 'package.json'), 'utf8'));
  return { node: process.version, ...pkg.devDependencies };
}

function runContext(config, claudeVersion) {
  return {
    configHash: configHash(config),
    benchCommit: benchCommit(REPO_ROOT),
    versions: { claude_code: claudeVersion, ...packageVersions() },
  };
}

function parseArgs(argv) {
  const value = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
  const phase = value('--phase', 'pilot');
  if (!['pilot', 'full'].includes(phase)) throw new Error(`--phase must be pilot or full, not ${phase}`);
  return {
    command: argv[0],
    phase,
    confirm: argv.includes('--confirm'),
    configFile: value('--config', path.join(REPO_ROOT, 'runner.config.json')),
    resultsDir: value('--results', path.join(REPO_ROOT, 'results', phase)),
    budgetFile: value('--budget-file', path.join(REPO_ROOT, 'BUDGET.md')),
  };
}

const print = (lines) => console.log(lines.join('\n'));

function requirePreflight(config) {
  const { version, problems } = preflight(config);
  if (problems.length > 0) {
    print(['preflight failed:', ...problems.map((p) => `  - ${p}`)]);
    process.exit(1);
  }
  return version;
}

function cmdPlan(config, { phase }) {
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase });
  const tasks = [...new Set(plan.runs.map((r) => r.task))].sort();
  print([
    `${phase}: ${plan.runs.length} runs = ${tasks.length} tasks x ${config.arms.length} arms x ${config.repeats[phase]} repeats`,
    `tasks: ${tasks.join(', ')}${phase === 'pilot' ? ` (chosen with seed ${config.seeds.pilotTasks})` : ''}`,
    `order: shuffled with seed ${plan.seed}; first runs:`,
    ...plan.runs.slice(0, 9).map((r) => `  ${r.runId}  ${r.task}  arm ${r.arm}  repeat ${r.repeat}`),
  ]);
}

async function cmdPrepare(config) {
  for (const arm of config.arms) {
    const t = await ensureTemplate({ benchRoot: REPO_ROOT, arm, cacheRoot: CACHE, log: console.log });
    console.log(`arm ${arm}: ${t.dir} (${t.baselineCount} baselines)`);
  }
}

function cmdCheck(config) {
  const { version, problems } = preflight(config);
  print([`Claude Code: ${version ?? 'not found'}`, ...(problems.length ? ['problems:', ...problems.map((p) => `  - ${p}`)] : ['all checks passed'])]);
  process.exit(problems.length ? 1 : 0);
}

function gateFor(config, args, plannedRuns) {
  const dryRuns = readRecords(path.join(args.resultsDir, 'dry-run.jsonl'));
  return gate({ plannedRuns, dryRun: latestDryRun(dryRuns, configHash(config)), budgetUsd: readBudget(args.budgetFile), confirm: args.confirm });
}

async function cmdDryRun(config, args) {
  const version = requirePreflight(config);
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase: args.phase });
  const run = plan.runs.find((r) => r.arm === 'C') ?? plan.runs[0];
  const dir = path.join(args.resultsDir, 'dry-run');
  for (const sub of ['transcripts', 'diffs']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  const template = await ensureTemplate({ benchRoot: REPO_ROOT, arm: run.arm, cacheRoot: CACHE, log: console.log });
  console.log(`dry run: ${run.task} in arm ${run.arm} (one real run, not counted in the study)`);
  const record = await runOne({ benchRoot: REPO_ROOT, config, run, phase: 'dry-run', attempt: 1, resultsDir: dir, context: { ...runContext(config, version), templateDir: template.dir } });
  fs.appendFileSync(path.join(args.resultsDir, 'dry-run.jsonl'), `${JSON.stringify(record)}\n`);
  if (record.error) {
    print([`the dry run ended in an error (${record.error.stage}): ${record.error.message}`]);
    process.exit(1);
  }
  const g = gateFor(config, args, plan.runs.length);
  const full = planFor({ benchRoot: REPO_ROOT, config, phase: 'full' }).runs.length;
  print([...g.lines, `projected for the full study (${full} runs): $${(record.cost_usd * full).toFixed(2)}`,
    `this run: ${record.success ? 'success' : 'failure'}, ${record.turns} turns, ${Math.round(record.seconds)} s`]);
}

function checkPlanFile(dir, plan) {
  const file = path.join(dir, 'plan.json');
  if (fs.existsSync(file)) {
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (JSON.stringify(before.runs) !== JSON.stringify(plan.runs)) {
      throw new Error(`${file} holds a different plan: the tasks, arms, repeats or seeds changed since this phase started. Use a new results directory.`);
    }
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
}

async function cmdStart(config, args) {
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase: args.phase });
  const done = finishedRuns(readRecords(path.join(args.resultsDir, 'runs.jsonl')));
  const remaining = plan.runs.filter((r) => !done.has(r.runId)).length;
  const g = gateFor(config, args, remaining);
  print(g.lines);
  if (!g.ok) process.exit(1);
  const version = requirePreflight(config);
  checkPlanFile(args.resultsDir, plan);
  const records = await executePlan({ benchRoot: REPO_ROOT, config, plan, resultsDir: args.resultsDir, context: runContext(config, version), log: console.log });
  print([`${finishedRuns(records).size} of ${plan.runs.length} runs finished.`, `next: npm run analyze -- --phase ${args.phase}`]);
}

function cmdStatus(config, args) {
  const plan = planFor({ benchRoot: REPO_ROOT, config, phase: args.phase });
  const records = readRecords(path.join(args.resultsDir, 'runs.jsonl'));
  const finished = finishedRuns(records);
  const cost = records.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  print([`${args.phase}: ${finished.size} of ${plan.runs.length} runs finished, ${records.length} attempts, $${cost.toFixed(2)} spent`]);
}

const PROBE_PROMPT = (benchRoot) => [
  'This is a check of the test machine, not a task. Do not change any file.',
  'Run each command below as its own shell command, in order. For each one, report its exit code and the last line of its output.',
  '1. npx playwright test tests/functional.spec.ts',
  '2. curl -sS -m 10 -o /dev/null -w "%{http_code}" https://example.com',
  '3. curl -sS -m 10 -o /dev/null -w "%{http_code}" https://registry.npmjs.org/',
  `4. ls ${benchRoot}`,
  '5. node server.js & sleep 2; curl -sS -m 5 http://127.0.0.1:$PORT/ | head -c 60; kill %1',
  'End with STATUS: DONE.',
].join('\n');

const PROBE_EXPECTED = ['1: the functional tests pass', '2: blocked (no network)', '3: allowed (the package registry)', '4: refused (the benchmark is not readable)', '5: the page is served'];

async function cmdProbe(config, args) {
  requirePreflight(config);
  const template = await ensureTemplate({ benchRoot: REPO_ROOT, arm: 'A', cacheRoot: CACHE, log: console.log });
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-'));
  const ws = buildWorkspace({ benchRoot: REPO_ROOT, taskId: 't13', arm: 'A', templateDir: template.dir, runDir });
  fs.mkdirSync(path.join(runDir, 'home', '.claude'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'tmp'), { recursive: true });
  const settingsFile = path.join(runDir, 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify(buildSettings({ arm: 'A', benchRoot: REPO_ROOT, isolation: config.isolation, allowedNetwork: config.allowedNetwork })));
  const dir = path.join(args.resultsDir, '..', 'probe');
  fs.mkdirSync(dir, { recursive: true });
  const res = await runAgent({
    command: config.agent.command,
    args: buildClaudeArgs({ agent: { ...config.agent, maxTurns: 15 }, prompt: PROBE_PROMPT(REPO_ROOT), settingsFile, instructionsFile: path.join(ws, 'CLAUDE.md'), mcpConfigFile: null }),
    cwd: ws,
    env: buildAgentEnv({ baseEnv: process.env, runDir, port: await freePort(), browsersPath: browsersPath() }),
    timeLimitMs: 10 * 60 * 1000,
    transcriptFile: path.join(dir, `probe-${Date.now()}.jsonl`),
    secrets: secretValues(),
  });
  fs.rmSync(runDir, { recursive: true, force: true });
  const p = parseStream(res.stdout);
  print([
    `probe: ${p.hasResult ? p.subtype : 'no result'}, $${(p.costUsd ?? 0).toFixed(2)}`,
    'expected:', ...PROBE_EXPECTED.map((e) => `  ${e}`),
    'what happened (each command and the start of its output):',
    ...p.toolCalls.map((c) => `  $ ${c.input.command ?? c.name}\n    ${String(p.toolResults[c.id] ?? '').replace(/\s+/g, ' ').slice(0, 300)}`),
    '', p.finalText,
  ]);
}

const COMMANDS = { plan: cmdPlan, prepare: cmdPrepare, check: cmdCheck, probe: cmdProbe, 'dry-run': cmdDryRun, start: cmdStart, status: cmdStatus };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.configFile);
  const problems = validateConfig(config);
  if (problems.length > 0) {
    print(['runner.config.json is not valid:', ...problems.map((p) => `  - ${p}`)]);
    process.exit(2);
  }
  const command = COMMANDS[args.command];
  if (!command) {
    print([`unknown command "${args.command ?? ''}". Commands: ${Object.keys(COMMANDS).join(', ')}`]);
    process.exit(2);
  }
  await command(config, args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
