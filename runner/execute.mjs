// Runs a plan: in order, resumable, each run retried once if it ends in an
// error. Every attempt is appended to runs.jsonl; nothing is ever removed.
import fs from 'node:fs';
import path from 'node:path';
import { runOne } from './run-one.mjs';
import { ensureTemplate } from './templates.mjs';
import { waitFor } from './limits.mjs';

export function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

const isLimit = (r) => r.error?.stage === 'limit';

// A run is finished when its last attempt has no error, or when it has ended
// in an error twice. An attempt cut off by a usage limit does not count.
export function finishedRuns(records) {
  const byRun = new Map();
  for (const r of records) byRun.set(r.run_id, [...(byRun.get(r.run_id) ?? []), r]);
  const finished = [...byRun.entries()].filter(([, attempts]) => {
    const last = attempts[attempts.length - 1];
    return !last.error || (!isLimit(last) && attempts.filter((a) => a.error && !isLimit(a)).length >= 2);
  });
  return new Set(finished.map(([id]) => id));
}

const errorsOf = (records, runId) => records.filter((r) => r.run_id === runId && r.error && !isLimit(r)).length;

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

const realSleep = (ms) => new Promise((done) => setTimeout(done, ms));
// After this many waits for a limit, the runner moves on; the run stays unfinished and resumes next time.
const MAX_WAITS = 30;

export async function executePlan({ benchRoot, config, plan, resultsDir, context, extraEnvFor = () => ({}), log = () => {}, sleep = realSleep }) {
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
    let waits = 0;
    while (errorsOf(readRecords(file), run.runId) < 2) {
      const record = await runOne({
        benchRoot, config, run, phase: plan.phase, attempt, resultsDir,
        context: { ...context, templateDir: templates[run.arm].dir, extraEnv: { ...(context.extraEnv ?? {}), ...extraEnvFor(run, attempt) } },
      });
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
      log(`${run.runId} ${run.task}/${run.arm}#${run.repeat} attempt ${attempt}: ${record.error ? `error (${record.error.stage})` : record.success ? 'success' : 'failure'}`);
      if (!record.error) break;
      if (isLimit(record)) {
        if (waits >= MAX_WAITS) break;
        const ms = waitFor({ resetAt: record.error.resume_at }, waits);
        log(`${run.runId}: usage limit, waiting ${Math.round(ms / 60000)} min`);
        await sleep(ms);
        waits += 1;
      }
      attempt += 1;
    }
  });
  return readRecords(file);
}
