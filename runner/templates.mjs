// One template per arm and machine: the arm's pinned packages installed, and
// its baselines recorded from the clean app. Workspaces copy from it.
// Built once, cached under .cache/runner/templates/, rebuilt when the app,
// the arm's files, Node or the platform change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyApp, hashTree } from '../harness/workspace.mjs';
import { freePort } from '../harness/run-specs.mjs';
import { withLock } from '../harness/lock.mjs';
import { armFilesDir, BASELINE_DIRS } from './arms.mjs';

const OUTPUTS = ['test-results', 'playwright-report', 'visual-report', path.join('.testivai', 'temp')];

export function browsersPath(env = process.env) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') return env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (process.platform === 'win32') return path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  return path.join(os.homedir(), '.cache', 'ms-playwright');
}

export function templateKey({ benchRoot, arm }) {
  return crypto.createHash('sha256')
    .update(arm)
    .update(hashTree(path.join(benchRoot, 'app')))
    .update(hashTree(armFilesDir(arm)))
    .update(`${process.version} ${process.platform} ${process.arch}`)
    .digest('hex')
    .slice(0, 16);
}

function run(cwd, command, args, env, what) {
  const r = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  if (r.status !== 0) {
    throw new Error(`${what} failed (exit ${r.status}${r.signal ? `, ${r.signal}` : ''}):\n${(r.stdout ?? '').slice(-3000)}\n${(r.stderr ?? '').slice(-3000)}`);
  }
  return r.stdout;
}

const clearOutputs = (dir) => OUTPUTS.forEach((o) => fs.rmSync(path.join(dir, o), { recursive: true, force: true }));

async function playwright(dir, args, what) {
  const env = { ...process.env, PORT: String(await freePort()), PLAYWRIGHT_BROWSERS_PATH: browsersPath(), FORCE_COLOR: '0', CI: '' };
  return run(dir, process.execPath, [path.join(dir, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...args], env, what);
}

// B: Playwright writes the screenshots, then a second run must match them exactly.
async function recordPixelBaselines(dir) {
  await playwright(dir, ['tests/visual.spec.ts', '--update-snapshots'], 'recording the screenshot baselines');
  clearOutputs(dir);
  await playwright(dir, ['tests/visual.spec.ts'], 'checking the screenshot baselines on the clean app');
  clearOutputs(dir);
}

// C: the first run captures the clean app and reports every snapshot as new;
// approving them makes them the baselines (the step a person takes once);
// a second run must then report no change.
async function recordTestivaiBaselines(dir) {
  await playwright(dir, ['tests/visual.spec.ts'], 'capturing the clean app for the testivai baselines');
  run(dir, path.join(dir, 'node_modules', '.bin', 'testivai'), ['approve', '--all'], process.env, 'approving the testivai baselines');
  clearOutputs(dir);
  await playwright(dir, ['tests/visual.spec.ts'], 'checking the testivai baselines on the clean app');
  const results = JSON.parse(fs.readFileSync(path.join(dir, 'visual-report', 'results.json'), 'utf8'));
  const { total, passed } = results.summary;
  if (total !== 12 || passed !== 12) {
    throw new Error(`testivai reports differences on the clean app against its own baselines: ${JSON.stringify(results.summary)}`);
  }
  clearOutputs(dir);
}

function countBaselines(dir, arm) {
  return BASELINE_DIRS[arm].reduce((n, rel) => {
    const full = path.join(dir, rel);
    return n + (fs.existsSync(full) ? fs.readdirSync(full).filter((f) => !f.startsWith('.')).length : 0);
  }, 0);
}

// Built in a neutral temporary path, so nothing recorded in a baseline names
// the benchmark's directory.
async function buildTemplate({ benchRoot, arm }) {
  const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-template-'));
  const dir = path.join(holder, 'project');
  copyApp(path.join(benchRoot, 'app'), dir);
  fs.cpSync(armFilesDir(arm), dir, { recursive: true });
  run(dir, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], process.env, `npm ci for arm ${arm}`);
  if (arm === 'B') await recordPixelBaselines(dir);
  if (arm === 'C') await recordTestivaiBaselines(dir);
  return { holder, dir };
}

export async function ensureTemplate({ benchRoot, arm, cacheRoot, log = console.log }) {
  const key = templateKey({ benchRoot, arm });
  const final = path.join(cacheRoot, 'templates', `${arm}-${key}`);
  const marker = path.join(final, '.template.json');
  if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf8'));
  return withLock(final, async () => {
    if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf8'));
    return createTemplate({ benchRoot, arm, key, final, log });
  });
}

async function createTemplate({ benchRoot, arm, key, final, log }) {
  log(`building the arm ${arm} template (packages and baselines)…`);
  const { holder, dir } = await buildTemplate({ benchRoot, arm });
  const info = { arm, key, dir: final, baselineCount: countBaselines(dir, arm), node: process.version, createdAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(final), { recursive: true });
  fs.rmSync(final, { recursive: true, force: true });
  fs.cpSync(dir, final, { recursive: true });
  fs.writeFileSync(path.join(final, '.template.json'), `${JSON.stringify(info, null, 2)}\n`);
  fs.rmSync(holder, { recursive: true, force: true });
  return info;
}
