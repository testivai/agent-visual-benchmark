#!/usr/bin/env node
// Validates a generated task set (study2/validation.mjs) on the drawn sites,
// with the drift setting chosen in study2/drift.json. Exits 1 on any problem.
//   node study2/validate-tasks.mjs <tasks.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { setProblems, taskProblems } from './validation.mjs';
import { captureSite, siteViews } from './validity.mjs';
import { DRIFT_SETTINGS, withDriftBrowser } from './drift.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');
const CSS_FILE = path.join('css', 'styles.css');

const file = process.argv[2];
if (!file) throw new Error('usage: node study2/validate-tasks.mjs <tasks.json>');
const { tasks } = JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(SITES, 'manifest.json'), 'utf8'));
const { chosen } = JSON.parse(fs.readFileSync(path.join(HERE, 'drift.json'), 'utf8'));
const setting = DRIFT_SETTINGS.find((s) => s.name === chosen);
if (!setting) throw new Error(`study2/drift.json names no known setting (${chosen})`);

const sites = Object.fromEntries(manifest.chosen.map((name) => {
  const short = name.replace(/^startbootstrap-/, '');
  return [short, { siteDir: path.join(SITES, short, 'site'), cssFile: CSS_FILE, pages: manifest.imported[name].pages }];
}));
const css = Object.fromEntries(Object.entries(sites).map(([k, s]) => [k, fs.readFileSync(path.join(s.siteDir, CSS_FILE), 'utf8')]));

const problems = setProblems(tasks, { css });
const browser = await chromium.launch();
try {
  for (const site of Object.values(sites)) site.clean = await captureSite(browser, site.siteDir, siteViews(site.pages));
  await withDriftBrowser(setting, async (drifting) => {
    for (const site of Object.values(sites)) site.drifted = await captureSite(drifting, site.siteDir, siteViews(site.pages));
  });
  for (const task of tasks) {
    const found = await taskProblems(browser, { task, ...sites[task.site] });
    console.log(`${task.id} ${task.stratum} ${task.site}: ${found.length === 0 ? 'ok' : found.join('; ')}`);
    problems.push(...found);
  }
} finally {
  await browser.close();
}
console.log(problems.length === 0 ? `\nall ${tasks.length} tasks valid` : `\n${problems.length} problem(s):\n${problems.join('\n')}`);
process.exitCode = problems.length === 0 ? 0 : 1;
