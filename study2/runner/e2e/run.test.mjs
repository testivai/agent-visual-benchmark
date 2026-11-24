// Study 2 through the runner end to end, with the fake agent: real templates
// (drifted ones included), real workspaces, real scoring by the oracle.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { executePlan } from '../../../runner/execute.mjs';
import { loadConfig, selectModel } from '../../../runner/config.mjs';
import { REPO_ROOT } from '../../../harness/workspace.mjs';
import { studyTwo } from '../study.mjs';
import { siteDir, PROMPT } from '../arms.mjs';
import { parseRules } from '../../css.mjs';
import { applyMutations } from '../../mutate.mjs';

const FAKE = [process.execPath, path.join(REPO_ROOT, 'runner', 'fake-claude.mjs')];
const CSS = fs.readFileSync(path.join(siteDir('bare'), 'css', 'styles.css'), 'utf8');
const RULES = parseRules(CSS);
const at = (selector, property, to) => {
  const r = RULES.find((x) => x.selector === selector && x.media === null);
  const d = r.declarations.find((x) => x.property === property);
  return { ruleId: r.id, selector, media: null, property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
};
const LEAD = at('.lead', 'font-size', '1.875rem');
const BRAND = at('.navbar-dark', '--bs-navbar-brand-color', '#000000');
const TASKS = [
  { id: 'e1', stratum: 'S1', site: 'bare', drift: false, mutations: [LEAD] },
  { id: 'e2', stratum: 'S2', site: 'bare', drift: false, mutations: [LEAD, BRAND] },
  { id: 'e3', stratum: 'S3', site: 'bare', drift: true, mutations: [LEAD] },
  { id: 'e4', stratum: 'S4', site: 'bare', drift: true, mutations: [] },
];

let scratch;
let records;
const patches = {};

// The patch that turns the stylesheet `from` into `to`, as the agent would leave it.
function patchFile(name, from, to) {
  const repo = path.join(scratch, `patch-${name}`);
  fs.mkdirSync(path.join(repo, 'site', 'css'), { recursive: true });
  const git = (args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: scratch } });
  fs.writeFileSync(path.join(repo, 'site', 'css', 'styles.css'), from);
  git(['init', '-q']);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'from']);
  fs.writeFileSync(path.join(repo, 'site', 'css', 'styles.css'), to);
  const file = path.join(scratch, `${name}.patch`);
  fs.writeFileSync(file, git(['diff']));
  return file;
}

function testConfig() {
  const base = loadConfig(path.join(REPO_ROOT, 'runner.config.json'));
  return selectModel({
    ...base, arms: ['B', 'C'], isolation: 'none', concurrency: 2,
    agent: { ...base.agent, command: FAKE, timeLimitMinutes: 3 },
    models: { fake: { model: 'claude-fake-1', provider: 'anthropic-api-key', primary: true } },
  }, 'fake');
}

const RUNS = [
  ['e1', 'B', 'revertLead'], ['e1', 'C', 'empty'], ['e2', 'C', 'halfway'], ['e3', 'C', 'revertLead'],
  ['e4', 'B', 'empty'], ['e4', 'C', 'tidy'], ['e1', 'C', 'revertLead', 'touch-baseline'], ['e3', 'B', 'revertLead', 'crash-once'],
];
const PLAN = { phase: 'test', seed: 1, runs: RUNS.map(([task, arm], i) => ({ runId: `s2-${i + 1}`, order: i + 1, task, arm, repeat: 1 })) };
const last = (id) => records.filter((r) => r.run_id === id).at(-1);

before(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-e2e-'));
  const seeded = applyMutations(CSS, [LEAD]);
  patches.revertLead = patchFile('revert-lead', seeded, CSS);
  patches.halfway = patchFile('halfway', applyMutations(CSS, [LEAD, BRAND]), applyMutations(CSS, [BRAND]));
  patches.tidy = patchFile('tidy', CSS, `${CSS}\n/* tidied */\n`);
  patches.empty = path.join(scratch, 'empty.patch');
  fs.writeFileSync(patches.empty, '');
  const resultsDir = path.join(scratch, 'results');
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state);
  records = await executePlan({
    benchRoot: REPO_ROOT,
    config: testConfig(),
    plan: PLAN,
    resultsDir,
    context: { configHash: 'test', benchCommit: 'test', versions: {}, study: studyTwo({ tasks: TASKS }), extraEnv: { ANTHROPIC_API_KEY: 'sk-ant-api03-FAKE-0123456789' } },
    extraEnvFor: (run) => {
      const [, , patch, mode] = RUNS[run.order - 1];
      return { FAKE_CLAUDE_MODE: mode ?? 'apply', FAKE_CLAUDE_PATCH: patches[patch], FAKE_CLAUDE_STATE: path.join(state, run.runId), FAKE_CLAUDE_RECORD: path.join(state, `${run.runId}.args.json`) };
    },
  });
}, { timeout: 30 * 60 * 1000 });

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

test('the agent gets study 2\'s one prompt and instructions', () => {
  const { args } = JSON.parse(fs.readFileSync(path.join(scratch, 'state', 's2-1.args.json'), 'utf8'));
  assert.ok(args.includes(PROMPT), 'the prompt');
});

test('S1: the fix reverted is a success; nothing done is a failure', () => {
  assert.deepEqual([last('s2-1').error, last('s2-1').success, last('s2-1').task_category, last('s2-1').site], [null, true, 'S1', 'bare']);
  assert.deepEqual([last('s2-2').success, last('s2-2').fixed, last('s2-2').collateral_clean], [false, false, true]);
});

test('S2: half of the fix is a failure, with partial credit', () => {
  const r = last('s2-3');
  assert.equal(r.success, false);
  assert.deepEqual(r.partial_credit, { restored: 1, of: 2, share: 0.5, each: [true, false] });
});

test('S3: against drifted baselines, the fix reverted is a success', () => {
  assert.deepEqual([last('s2-4').success, last('s2-4').drift], [true, true]);
});

test('S4: leaving the site as it is succeeds; editing its stylesheet fails, even when it measures the same', () => {
  assert.deepEqual([last('s2-5').success, last('s2-5').task_type], [true, 'decoy']);
  const r = last('s2-6');
  assert.equal(r.success, false);
  assert.deepEqual(r.site_files, ['site/css/styles.css']);
  assert.equal(r.measured.collateral, 0);
});

test('a fix with a baseline touched is tampering; a crash is retried once', () => {
  assert.deepEqual([last('s2-7').tampered, last('s2-7').success], [true, false]);
  const attempts = records.filter((r) => r.run_id === 's2-8');
  assert.deepEqual(attempts.map((r) => r.error?.stage ?? null), ['agent', null]);
  assert.equal(attempts.at(-1).success, true);
});
