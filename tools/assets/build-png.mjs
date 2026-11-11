#!/usr/bin/env node
// Renders tools/assets/workshop.svg to a PNG at a given pixel density.
//   node tools/assets/build-png.mjs <scale> <out.png>
// The app ships the 2x export (960x600 for a 480x300 box).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const [scale = '2', out = path.join(here, '..', '..', 'app', 'site', 'assets', 'workshop.png')] = process.argv.slice(2);
const svg = fs.readFileSync(path.join(here, 'workshop.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 300 }, deviceScaleFactor: Number(scale) });
await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`);
await page.locator('svg').screenshot({ path: out });
await browser.close();
console.log(`${out}: ${480 * Number(scale)}x${300 * Number(scale)}`);
