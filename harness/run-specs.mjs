// Runs Playwright specs against a workspace and turns the JSON report into one
// outcome per spec file: 'passed', 'failed' or 'error'.
// 'error' = the spec gave no verdict (crash, timeout, nothing ran, flaky).
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { REPO_ROOT } from './workspace.mjs';

export const INFRA_PREFIX = 'ORACLE_INFRA:';
const PLAYWRIGHT_CLI = path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (message) => String(message ?? '').replace(ANSI, '').trim();

function collectSpecs(suite, rootDir, into) {
  for (const spec of suite.specs ?? []) {
    const file = path.resolve(rootDir, spec.file ?? suite.file ?? '');
    if (!into.has(file)) into.set(file, []);
    into.get(file).push(spec);
  }
  for (const child of suite.suites ?? []) {
    collectSpecs({ ...child, file: child.file ?? suite.file }, rootDir, into);
  }
}

function resultsOf(spec) {
  return (spec.tests ?? []).flatMap((t) => t.results ?? []);
}

// One spec (one test()): its verdict and, when it is not a pass, why.
function judgeSpec(spec) {
  const results = resultsOf(spec);
  const message = clean(results.find((r) => r.error)?.error?.message);
  const statuses = results.map((r) => r.status);
  if (statuses.length === 0 || statuses.every((s) => s === 'skipped')) {
    return { verdict: 'error', message: 'the test was skipped or did not run' };
  }
  if (statuses.some((s) => s === 'timedOut' || s === 'interrupted')) {
    return { verdict: 'error', message: message || 'the test timed out' };
  }
  if (results.some((r) => clean(r.error?.message).includes(INFRA_PREFIX))) {
    return { verdict: 'error', message };
  }
  if (new Set(statuses).size > 1) {
    return { verdict: 'error', message: `the test gave different results on retry (${statuses.join(', ')})` };
  }
  return spec.ok ? { verdict: 'passed' } : { verdict: 'failed', message };
}

function judgeFile(specs) {
  if (!specs || specs.length === 0) {
    return { status: 'error', tests: 0, failures: [{ title: '', message: 'no tests ran for this file' }] };
  }
  const judged = specs.map((spec) => ({ title: spec.title, ...judgeSpec(spec) }));
  const pick = (verdict) => judged.filter((j) => j.verdict === verdict).map(({ title, message }) => ({ title, message }));
  const errors = pick('error');
  if (errors.length > 0) return { status: 'error', tests: specs.length, failures: errors };
  const failures = pick('failed');
  return { status: failures.length > 0 ? 'failed' : 'passed', tests: specs.length, failures };
}

export function summarizeReport(report, specFiles, fallbackMessage = 'playwright produced no report') {
  const allError = (message) => Object.fromEntries(
    specFiles.map((file) => [file, { status: 'error', tests: 0, failures: [{ title: '', message }] }]),
  );
  if (!report) return allError(fallbackMessage);
  if ((report.errors ?? []).length > 0) return allError(clean(report.errors[0].message));
  const byFile = new Map();
  for (const suite of report.suites ?? []) collectSpecs(suite, report.config?.rootDir ?? '', byFile);
  return Object.fromEntries(specFiles.map((file) => [file, judgeFile(byFile.get(path.resolve(file)))]));
}

function parseReport(stdout) {
  const start = stdout.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    return null;
  }
}

function runPlaywright({ cwd, args, env, timeoutMs = 10 * 60 * 1000 }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PLAYWRIGHT_CLI, 'test', ...args, '--reporter=json'], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', CI: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, report: parseReport(stdout) });
    });
  });
}

// Oracle specs against a workspace. `specs` are absolute paths under <benchRoot>/oracle.
export async function runOracleSpecs({ benchRoot, appDir, specs, env = {} }) {
  const config = path.join(benchRoot, 'oracle', 'playwright.config.ts');
  const { code, stderr, report } = await runPlaywright({
    cwd: benchRoot,
    args: ['-c', config, ...specs],
    env: { BENCH_APP_DIR: appDir, BENCH_ROOT: benchRoot, ...env },
  });
  return summarizeReport(report, specs, `playwright exited with code ${code}: ${clean(stderr).slice(0, 2000)}`);
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// The app's own functional suite, run inside the workspace with its own config.
// Returns 'passed' | 'failed' | 'error' and the failures.
export async function runFunctional({ appDir }) {
  const port = await freePort();
  const { code, stderr, report } = await runPlaywright({ cwd: appDir, args: [], env: { PORT: String(port) } });
  if (!report) {
    return { status: 'error', failures: [{ title: '', message: `playwright exited with code ${code}: ${clean(stderr).slice(0, 2000)}` }] };
  }
  if ((report.errors ?? []).length > 0) {
    return { status: 'error', failures: [{ title: '', message: clean(report.errors[0].message) }] };
  }
  const byFile = new Map();
  for (const suite of report.suites ?? []) collectSpecs(suite, report.config?.rootDir ?? '', byFile);
  const judged = judgeFile([...byFile.values()].flat());
  return { status: judged.status, failures: judged.failures };
}
