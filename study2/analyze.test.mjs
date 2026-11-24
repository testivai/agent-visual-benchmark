import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'analyze.mjs');
const line = (o) => JSON.stringify(o);

// A transcript whose agent ran `command` and said it was done.
const transcript = (command) => [
  line({ type: 'system', subtype: 'init', cwd: '/var/tmp/avb-runs/avb-x/project', model: 'm', tools: ['Bash'] }),
  line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command } }] } }),
  line({ type: 'result', subtype: 'success', is_error: false, num_turns: 4, duration_ms: 20000, total_cost_usd: 0.1, result: 'Fixed.\nSTATUS: DONE' }),
].join('\n');

function resultsDir() {
  // results/study2/<model>/<phase>/, as the runner writes it
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-analyze-'));
  const dir = path.join(root, 'sonnet', 'full-rung1');
  fs.mkdirSync(dir, { recursive: true });
  const tasks = [{ id: 'a', stratum: 'S1' }, { id: 'b', stratum: 'S2' }, { id: 'c', stratum: 'S3' }, { id: 'd', stratum: 'S4' }];
  const records = [];
  for (const t of tasks) {
    for (const arm of ['B', 'C']) {
      records.push({
        run_id: `r-${t.id}-${arm}`, attempt: 1, task: t.id, arm, repeat: 1, success: true, error: null,
        model: 'model-id-recorded', claimed_done: true, false_done: false, collateral_clean: true, tampered: false, turns: 4, seconds: 20, cost_usd: 0.1,
        // as recorded with the old flag rule
        flags: arm === 'B' ? ['update_snapshots'] : [],
        tokens: { input: arm === 'C' ? 300 : 200, output: 0, cacheRead: 0, cacheWrite: 0 },
      });
    }
  }
  fs.writeFileSync(path.join(dir, 'runs.jsonl'), `${records.map(line).join('\n')}\n`);
  fs.mkdirSync(path.join(dir, 'transcripts'));
  for (const r of records) {
    fs.writeFileSync(path.join(dir, 'transcripts', `${r.run_id}-a1.jsonl`), transcript('npx playwright test 2>&1 | sort -u'));
  }
  const stats = { candidates: 10, kept: 3, byClass: { margin: { kept: 3, rejected: { "arm B's check (Playwright) does not flag it": 1 } } } };
  fs.writeFileSync(path.join(dir, 'tasks.json'), line({ rung: 1, stats, tasks }));
  fs.writeFileSync(path.join(dir, 'calibration.json'), line({ pooled: { successes: 5, runs: 6, rate: 5 / 6 }, spread: { sd: 0, tasks: 3, powerAt60: 1 } }));
  return dir;
}

const run = (args) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('the flags are read again from the transcripts; the JSON goes to stdout as before', () => {
  const dir = resultsDir();
  try {
    const out = JSON.parse(run([path.join(dir, 'runs.jsonl'), path.join(dir, 'tasks.json')]));
    assert.equal(out.runs.total, 8);
    assert.deepEqual(out.flags, { B: {}, C: {} }, 'sort -u after the pipe is not playwright\'s -u');
    assert.deepEqual(out.rederived, { checked: 8, missing: 0, changed: 4 });
    assert.ok(out.h1 && out.h2 && out.verdict);
    assert.equal(fs.existsSync(path.join(dir, 'summary.md')), false, 'nothing is written without --write');
  } finally {
    fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true });
  }
});

test('--write puts summary.md and analysis.json beside runs.jsonl, with the pilot and the generation', () => {
  const dir = resultsDir();
  try {
    run([path.join(dir, 'runs.jsonl'), path.join(dir, 'tasks.json'), '--write', '--pilot', path.join(dir, 'calibration.json')]);
    const md = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8');
    assert.match(md, /^# Study 2 results: sonnet, full-rung1$/m, 'named by its results folder, as study 1\'s summaries are');
    assert.doesNotMatch(md, /model-id-recorded/);
    assert.match(md, /4 of 8 runs differ from runs\.jsonl/);
    assert.match(md, /## Against the pilot that sized the study/);
    assert.match(md, /Of the 10 candidates drawn, 4 had a measured change/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'analysis.json'), 'utf8')).runs.total, 8);
  } finally {
    fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true });
  }
});
