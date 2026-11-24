#!/usr/bin/env node
// Chooses study 2's drift setting on the drawn sites (study2/drift.mjs) and
// writes study2/drift.json: the setting chosen, and for each setting tried,
// why it was not, and how many pixels each arm's check saw.
//   node study2/choose-drift.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { chooseDrift, DRIFT_SETTINGS } from './drift.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');
const manifest = JSON.parse(fs.readFileSync(path.join(SITES, 'manifest.json'), 'utf8'));

const sites = manifest.chosen.map((name) => {
  const short = name.replace(/^startbootstrap-/, '');
  return { name: short, siteDir: path.join(SITES, short, 'site'), pages: manifest.imported[name].pages };
});

const browser = await chromium.launch();
try {
  const result = await chooseDrift(browser, { sites, settings: DRIFT_SETTINGS });
  const record = { chosen: result.chosen, run: new Date().toISOString(), chromium: browser.version(), settings: DRIFT_SETTINGS, tried: result.tried };
  fs.writeFileSync(path.join(HERE, 'drift.json'), `${JSON.stringify(record, null, 2)}\n`);
  for (const t of result.tried) {
    const bad = Object.entries(t.problems).filter(([, p]) => p.length > 0).map(([site, p]) => `${site}: ${p.length} problem(s), e.g. ${p[0]}`);
    console.log(`${t.name}: ${bad.length === 0 ? 'every view of every site drifts' : bad.join('; ')}`);
  }
  console.log(`chosen: ${result.chosen}`);
} finally {
  await browser.close();
}
