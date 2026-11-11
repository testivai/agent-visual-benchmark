// Runs a plan: in order, resumable, each run retried once if it ends in an
// error. Every attempt is appended to runs.jsonl; nothing is ever removed.
import fs from 'node:fs';
import path from 'node:path';
import { runOne } from './run-one.mjs';
import { ensureTemplate } from './templates.mjs';

export function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

// A run is finished when its last attempt has no error, or it has had two attempts.
export function finishedRuns(records) {
  const last = new Map();
  for (const r of records) last.set(r.run_id, r);
  return new Set([...last.values()].filter((r) => !r.error || r.attempt >= 2).map((r) => r.run_id));
}

function nextAttempt(records, runId) {
  return records.filter((r) => r.run_id === runId).reduce((n, r) => Math.max(n, r.attempt), 0) + 1;
}

async function pool(items, concurrency, worker) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, lane));
}

export async function executePlan({ benchRoot, config, plan, resultsDir, context, extraEnvFor = () => ({}), log = () => {} }) {
  for (const dir of ['transcripts', 'diffs']) fs.mkdirSync(path.join(resultsDir, dir), { recursive: true });
  const file = path.join(resultsDir, 'runs.jsonl');
  const done = finishedRuns(readRecords(file));
  const pending = plan.runs.filter((r) => !done.has(r.runId));
  const templates = {};
  for (const arm of [...new Set(pending.map((r) => r.arm))].sort()) {
    templates[arm] = await ensureTemplate({ benchRoot, arm, cacheRoot: path.join(benchRoot, '.cache', 'runner'), log });
  }
  await pool(pending, config.concurrency, async (run) => {
    let attempt = nextAttempt(readRecords(file), run.runId);
    while (attempt <= 2) {
      const record = await runOne({
        benchRoot, config, run, phase: plan.phase, attempt, resultsDir,
        context: { ...context, templateDir: templates[run.arm].dir, extraEnv: { ...(context.extraEnv ?? {}), ...extraEnvFor(run, attempt) } },
      });
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
      log(`${run.runId} ${run.task}/${run.arm}#${run.repeat} attempt ${attempt}: ${record.error ? `error (${record.error.stage})` : record.success ? 'success' : 'failure'}`);
      if (!record.error) break;
      attempt += 1;
    }
  });
  return readRecords(file);
}
