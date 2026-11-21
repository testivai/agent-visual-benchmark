#!/usr/bin/env node
// Study 2's pilot calibration report (study2/calibration.mjs): pooled over B
// and C only, never per arm.
//   node study2/calibrate.mjs <runs.jsonl> <tasks.json> [--rung <n>]
import fs from 'node:fs';
import { calibrate } from './calibration.mjs';

const [runsFile, tasksFile] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--rung');
if (!runsFile || !tasksFile) throw new Error('usage: node study2/calibrate.mjs <runs.jsonl> <tasks.json> [--rung <n>]');
const i = process.argv.indexOf('--rung');
const rung = i < 0 ? 0 : Number(process.argv[i + 1]);
const records = fs.readFileSync(runsFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const { tasks } = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
console.log(JSON.stringify(calibrate(records, { tasks, rung }), null, 2));
