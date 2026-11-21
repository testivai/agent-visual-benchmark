#!/usr/bin/env node
// Validates a generated task set (study2/validation.mjs) on the drawn sites,
// with the drift setting chosen in study2/drift.json. Exits 1 on any problem.
// --arms also runs each arm's own visual test in each task's real workspace
// (study2/runner/arm-check.mjs): every task must be flagged by both.
//   node study2/validate-tasks.mjs <tasks.json> [--arms]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { setProblems, taskProblems } from './validation.mjs';
import { strataForRung } from './generate.mjs';
import { captureSite, siteViews } from './validity.mjs';
import { DRIFT_SETTINGS, withDriftBrowser } from './drift.mjs';
import { armTestFlags } from './runner/arm-check.mjs';
import { ensureSiteTemplate } from './runner/templates.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');
const CSS_FILE = path.join('css', 'styles.css');

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file) throw new Error('usage: node study2/validate-tasks.mjs <tasks.json> [--arms]');
const withArms = process.argv.includes('--arms');

// Each arm's own visual test in the task's workspace, as the agent will run it.
async function armProblems(task) {
  const out = [];
  for (const arm of ['B', 'C']) {
    const template = await ensureSiteTemplate({ site: task.site, arm, drift: task.drift ? setting : null, cacheRoot: path.join(REPO_ROOT, '.cache', 'runner') });
    const { flagged, views } = await armTestFlags({ task, arm, templateDir: template.dir, benchRoot: REPO_ROOT });
    if (!flagged) out.push(`${task.id}: arm ${arm}'s own visual test does not flag it`);
    else task.armViews = { ...task.armViews, [arm]: views };
  }
  return out;
}
const { tasks, rung = 0 } = JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(SITES, 'manifest.json'), 'utf8'));
const { chosen } = JSON.parse(fs.readFileSync(path.join(HERE, 'drift.json'), 'utf8'));
const setting = DRIFT_SETTINGS.find((s) => s.name === chosen);
if (!setting) throw new Error(`study2/drift.json names no known setting (${chosen})`);

const sites = Object.fromEntries(manifest.chosen.map((name) => {
  const short = name.replace(/^startbootstrap-/, '');
  return [short, { siteDir: path.join(SITES, short, 'site'), cssFile: CSS_FILE, pages: manifest.imported[name].pages }];
}));
const css = Object.fromEntries(Object.entries(sites).map(([k, s]) => [k, fs.readFileSync(path.join(s.siteDir, CSS_FILE), 'utf8')]));

// the set is checked against the rung it was generated at
const problems = setProblems(tasks, { strata: strataForRung(rung), css });
const browser = await chromium.launch();
try {
  for (const site of Object.values(sites)) site.clean = await captureSite(browser, site.siteDir, siteViews(site.pages));
  await withDriftBrowser(setting, async (drifting) => {
    for (const site of Object.values(sites)) site.drifted = await captureSite(drifting, site.siteDir, siteViews(site.pages));
  });
  for (const task of tasks) {
    const found = await taskProblems(browser, { task, ...sites[task.site] });
    if (withArms) found.push(...await armProblems(task));
    const views = task.armViews ? ` (views flagged: B ${task.armViews.B ?? 0}, C ${task.armViews.C ?? 0})` : '';
    console.log(`${task.id} ${task.stratum} ${task.site}: ${found.length === 0 ? 'ok' : found.join('; ')}${views}`);
    problems.push(...found);
  }
} finally {
  await browser.close();
}
console.log(problems.length === 0 ? `\nall ${tasks.length} tasks valid` : `\n${problems.length} problem(s):\n${problems.join('\n')}`);
process.exitCode = problems.length === 0 ? 0 : 1;
