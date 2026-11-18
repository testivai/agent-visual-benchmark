#!/usr/bin/env node
// Generates study 2's tasks on the drawn sites (study2/PREREGISTRATION.md, section 4).
//   node study2/generate-tasks.mjs --seed <n> --out <dir>
// The study's own seed is written in the preregistration before the real run;
// any other seed is a trial whose tasks are not used.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { generateTasks, siteChecker, drawStats } from './generate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');
const CSS_FILE = path.join('css', 'styles.css');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`usage: node study2/generate-tasks.mjs --seed <n> --out <dir> (missing --${name})`);
  return process.argv[i + 1];
}

const seed = Number(arg('seed'));
if (!Number.isInteger(seed) || seed < 0) throw new Error(`--seed must be a whole number, not ${arg('seed')}`);
const out = path.resolve(arg('out'));
const manifest = JSON.parse(fs.readFileSync(path.join(SITES, 'manifest.json'), 'utf8'));

const started = Date.now();
const browser = await chromium.launch();
try {
  const sites = {};
  for (const name of manifest.chosen) {
    const short = name.replace(/^startbootstrap-/, '');
    sites[short] = await siteChecker(browser, { siteDir: path.join(SITES, short, 'site'), cssFile: CSS_FILE, pages: manifest.imported[name].pages });
  }
  const result = await generateTasks({ sites, seed, check: (site, ms) => sites[site].check(ms) });
  const stats = drawStats(result.tasks);
  fs.mkdirSync(out, { recursive: true });
  const record = {
    seed,
    generated: new Date().toISOString(),
    chromium: browser.version(),
    sites: Object.fromEntries(Object.entries(sites).map(([k, s]) => [k, { rules: s.rules.length, used: s.used.size }])),
    stats,
    tasks: result.tasks,
  };
  fs.writeFileSync(path.join(out, 'tasks.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ seconds: Math.round((Date.now() - started) / 1000), sites: record.sites, stats }, null, 2));
} finally {
  await browser.close();
}
