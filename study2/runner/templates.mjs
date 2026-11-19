// Study 2's templates: one per site, arm and baselines (clean, or drifted for
// S3 and S4), built as study 1's are: the arm's packages installed and its
// baselines recorded from the clean site, then the arm's own test run again
// against them. Drifted baselines are recorded under the drift setting's font
// configuration; the build then checks that the arm's own test, run as the
// agent's machine runs it, flags every view. Cached under .cache/runner/templates/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, hashTree } from '../../harness/workspace.mjs';
import { freePort } from '../../harness/run-specs.mjs';
import { withLock } from '../../harness/lock.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';
import { run, playwright, clearOutputs, browsersPath } from '../../runner/templates.mjs';
import { BASELINE_DIRS } from '../../runner/arms.mjs';
import { fontconfigText } from '../drift.mjs';
import { assembleApp, siteDir, armFilesDir } from './arms.mjs';

// Bump to rebuild every cached study 2 template.
const TEMPLATE_FORMAT = 1;
// One page at two sizes.
const VIEWS = 2;
const SERVER = path.join(REPO_ROOT, 'study2', 'app', 'server.js');

export function templateKey({ site, arm, drift }) {
  return crypto.createHash('sha256')
    .update(`study2 ${arm} format ${TEMPLATE_FORMAT}`)
    .update(hashTree(siteDir(site)))
    .update(hashTree(armFilesDir(arm)))
    .update(fs.readFileSync(SERVER))
    .update(JSON.stringify(drift ?? null))
    .update(`${process.version} ${process.platform} ${process.arch}`)
    .digest('hex')
    .slice(0, 16);
}

export const templateName = ({ site, arm, drift }) => `s2-${site}-${arm}-${drift ? drift.name : 'clean'}-${templateKey({ site, arm, drift })}`;

// What the tests' browser needs to draw as the drift setting says, written in holder.
export function driftEnv(drift, holder) {
  if (!drift) return {};
  if (!drift.fontconfig) throw new Error(`drift setting ${drift.name}: only font settings can be recorded into baselines`);
  const file = path.join(holder, 'fonts.conf');
  fs.writeFileSync(file, fontconfigText(drift.fontconfig));
  return { FONTCONFIG_FILE: file };
}

const TEXT = /\.(?:json|html?|md|txt|ts|js|css|ya?ml)$/i;

// Text in the template that would tell the agent how its baselines were recorded.
export function leakProblems(dir, { holder }) {
  const needles = [holder, 'fonts.conf', 'FONTCONFIG', 'hintfull', 'hintstyle', 'drift'];
  const out = [];
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) visit(full);
      else if (TEXT.test(e.name) && fs.statSync(full).size < 4 * 1024 * 1024) {
        const text = fs.readFileSync(full, 'utf8');
        const rel = path.relative(dir, full).split(path.sep).join('/');
        for (const n of needles.filter((x) => text.includes(x))) out.push(`${rel} mentions "${n}"`);
      }
    }
  };
  visit(dir);
  return out;
}

// The arm's test as the agent's machine runs it: no font setting added. Never throws.
async function asTheAgentRunsIt(dir) {
  const { FONTCONFIG_FILE, ...base } = process.env;
  const env = { ...base, PORT: String(await freePort()), PLAYWRIGHT_BROWSERS_PATH: browsersPath(), FORCE_COLOR: '0', CI: '' };
  const r = spawnSync(process.execPath, [path.join(dir, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', 'tests/visual.spec.ts'], {
    cwd: dir, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000,
  });
  return { status: r.status, stdout: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const summaryOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'visual-report', 'results.json'), 'utf8')).summary;

async function recordPixel(dir, env) {
  await playwright(dir, ['tests/visual.spec.ts', '--update-snapshots'], 'recording the screenshot baselines', env);
  clearOutputs(dir);
  await playwright(dir, ['tests/visual.spec.ts'], 'checking the screenshot baselines under the same setting', env);
  clearOutputs(dir);
}

async function recordTestivai(dir, env) {
  await playwright(dir, ['tests/visual.spec.ts'], 'capturing the site for the testivai baselines', env);
  run(dir, path.join(dir, 'node_modules', '.bin', 'testivai'), ['approve', '--all'], process.env, 'approving the testivai baselines');
  clearOutputs(dir);
  await playwright(dir, ['tests/visual.spec.ts'], 'checking the testivai baselines under the same setting', env);
  const { total, passed } = summaryOf(dir);
  if (total !== VIEWS || passed !== VIEWS) throw new Error(`testivai reports differences against its own baselines: ${total} views, ${passed} passed`);
  clearOutputs(dir);
}

// Drifted baselines: the arm's own test, run as the agent runs it, must flag every view.
async function checkDriftShows(dir, arm) {
  const r = await asTheAgentRunsIt(dir);
  const flagged = arm === 'B' ? (r.status !== 0 && new RegExp(`\\b${VIEWS} failed\\b`).test(r.stdout)) : summaryOf(dir).changed === VIEWS;
  clearOutputs(dir);
  if (!flagged) throw new Error(`arm ${arm}'s own test does not flag every view against the drifted baselines:\n${r.stdout.slice(-2000)}`);
}

const countBaselines = (dir, arm) => BASELINE_DIRS[arm].reduce((n, rel) => {
  const full = path.join(dir, rel);
  return n + (fs.existsSync(full) ? fs.readdirSync(full).filter((f) => !f.startsWith('.')).length : 0);
}, 0);

async function buildTemplate({ site, arm, drift, holder }) {
  const dir = assembleApp({ site, arm, dest: path.join(holder, 'project') });
  run(dir, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], process.env, `npm ci for arm ${arm}`);
  const env = driftEnv(drift, holder);
  await (arm === 'B' ? recordPixel(dir, env) : recordTestivai(dir, env));
  if (drift) await checkDriftShows(dir, arm);
  const leaks = leakProblems(dir, { holder });
  if (leaks.length > 0) throw new Error(`the template says how its baselines were recorded:\n- ${leaks.join('\n- ')}`);
  return dir;
}

// The build's directory is removed whether it succeeds or not (study 1's lesson).
async function createTemplate({ site, arm, drift, final, log }) {
  log(`building the study 2 template for ${site}, arm ${arm}, ${drift ? `drifted (${drift.name})` : 'clean'} baselines…`);
  return withTempDir('avb-template-', async (holder) => {
    const dir = await buildTemplate({ site, arm, drift, holder });
    const info = {
      site, arm, drift: drift?.name ?? null, key: templateKey({ site, arm, drift }), dir: final,
      baselineCount: countBaselines(dir, arm), node: process.version, createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(final), { recursive: true });
    fs.rmSync(final, { recursive: true, force: true });
    fs.cpSync(dir, final, { recursive: true, verbatimSymlinks: true });
    fs.writeFileSync(path.join(final, '.template.json'), `${JSON.stringify(info, null, 2)}\n`);
    return info;
  });
}

// drift: a setting from DRIFT_SETTINGS (S3, S4) or null (S1, S2).
export async function ensureSiteTemplate({ site, arm, drift = null, cacheRoot, log = console.log }) {
  const final = path.join(cacheRoot, 'templates', templateName({ site, arm, drift }));
  const marker = path.join(final, '.template.json');
  if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf8'));
  return withLock(final, async () => {
    if (fs.existsSync(marker)) return JSON.parse(fs.readFileSync(marker, 'utf8'));
    return createTemplate({ site, arm, drift, final, log });
  });
}
