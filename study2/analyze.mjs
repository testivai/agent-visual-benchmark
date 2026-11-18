#!/usr/bin/env node
// Study 2's analysis (study2/analysis.mjs) of a run file, as JSON.
//   node study2/analyze.mjs <runs.jsonl> <tasks.json>
import fs from 'node:fs';
import { analyzeStudy2 } from './analysis.mjs';

const [runsFile, tasksFile] = process.argv.slice(2);
if (!runsFile || !tasksFile) throw new Error('usage: node study2/analyze.mjs <runs.jsonl> <tasks.json>');
const records = fs.readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const { tasks } = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
const r = analyzeStudy2(records, { tasks });
console.log(JSON.stringify({
  runs: r.runs, h1: r.h1, h2: r.h2, holm: r.holm, verdict: r.verdict, primary: r.primary, decoys: r.decoys,
  perArm: r.perArm, byStratum: r.byCategory, partialCredit: r.partialCredit, bBeatC: r.bBeatC, cBeatB: r.cBeatB, cost: r.cost, errored: r.errored,
}, null, 2));
