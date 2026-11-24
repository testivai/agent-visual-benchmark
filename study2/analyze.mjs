#!/usr/bin/env node
// Study 2's analysis (study2/analysis.mjs) of a run file, as JSON on stdout.
//   node study2/analyze.mjs <runs.jsonl> <tasks.json> [--write] [--pilot <calibration.json>]
// As study 1's analysis does, the fields that come from a transcript (turns, the
// done claim, agent time, shortcut flags) are read again from the transcripts
// beside runs.jsonl with the current parser (analysis/rederive.mjs); runs.jsonl
// is left as recorded. --write also writes summary.md (study2/summary.mjs) and
// analysis.json beside runs.jsonl; --pilot adds the pilot's calibration to it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeStudy2 } from './analysis.mjs';
import { describeStudy2, generationChecks } from './describe.mjs';
import { renderStudy2Summary } from './summary.mjs';
import { applyTranscripts } from '../analysis/rederive.mjs';

const BENCH_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const valueOf = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : null);
const pilotFile = valueOf('--pilot');
const [runsFile, tasksFile] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--pilot');
if (!runsFile || !tasksFile) throw new Error('usage: node study2/analyze.mjs <runs.jsonl> <tasks.json> [--write] [--pilot <calibration.json>]');

const dir = path.dirname(path.resolve(runsFile));
const recorded = fs.readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const transcriptOf = (r) => path.join(dir, 'transcripts', `${r.run_id}-a${r.attempt}.jsonl`);
const rederived = applyTranscripts(recorded, (r) => (fs.existsSync(transcriptOf(r)) ? fs.readFileSync(transcriptOf(r), 'utf8') : null), { benchRoot: BENCH_ROOT });
const taskSet = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
const { tasks } = taskSet;
const r = analyzeStudy2(rederived.records, { tasks });

const json = JSON.stringify({
  runs: r.runs, h1: r.h1, h2: r.h2, holm: r.holm, verdict: r.verdict, primary: r.primary, decoys: r.decoys,
  perArm: r.perArm, byStratum: r.byCategory, partialCredit: r.partialCredit, bBeatC: r.bBeatC, cBeatB: r.cBeatB, cost: r.cost, errored: r.errored,
  flags: r.flags, rederived: { checked: rederived.checked, missing: rederived.missing, changed: rederived.changed.length },
}, null, 2);
console.log(json);

if (argv.includes('--write')) {
  const described = describeStudy2(rederived.records, { tasks });
  const pilot = pilotFile ? JSON.parse(fs.readFileSync(pilotFile, 'utf8')) : null;
  const generation = taskSet.stats ? generationChecks(taskSet.stats) : null;
  // results/study2/<model>/<phase>/: named by its folders, as study 1's summaries are
  const model = path.basename(path.dirname(dir));
  const md = renderStudy2Summary(r, { model, phase: path.basename(dir), described, pilot, generation, rederived });
  fs.writeFileSync(path.join(dir, 'summary.md'), md);
  fs.writeFileSync(path.join(dir, 'analysis.json'), `${json}\n`);
}
