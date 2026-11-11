#!/usr/bin/env node
// Does a full-page screenshot show what a task's seed did?
// Compares screenshots of the clean app and the seeded app, page by page, at
// the desktop and phone sizes. This is a property of the task, recorded so
// readers know which tasks a screenshot tool can see. It never scores anything.
//
//   node harness/visibility.mjs            every task -> oracle/visibility.json
//   node harness/visibility.mjs t03 t07    print these tasks only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { REPO_ROOT, makeWorkspace, removeWorkspace, hashTree } from './workspace.mjs';
import { startStaticServer } from './static-server.mjs';
import { comparePngs } from './pixels.mjs';
import crypto from 'node:crypto';
import { PAGES, VIEWPORTS } from '../oracle/lib/views.mjs';

// Identifies the app and the seeds a measurement was taken on.
export function seedsHash(benchRoot = REPO_ROOT) {
  const h = crypto.createHash('sha256').update(hashTree(path.join(benchRoot, 'app', 'site')));
  for (const id of fs.readdirSync(path.join(benchRoot, 'tasks')).sort()) {
    h.update(id).update(fs.readFileSync(path.join(benchRoot, 'tasks', id, 'seed.patch')));
  }
  return h.digest('hex').slice(0, 16);
}

async function screenshots(browser, appDir) {
  const server = await startStaticServer(path.join(appDir, 'site'));
  const shots = {};
  try {
    for (const [viewport, size] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      for (const [name, file] of Object.entries(PAGES)) {
        await page.goto(`${server.url}/${file}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        shots[`${name}@${viewport}`] = await page.screenshot({ fullPage: true, animations: 'disabled' });
      }
      await context.close();
    }
  } finally {
    await server.close();
  }
  return shots;
}

// { 'home@desktop': { diffPixels, diffPercent, sizeChanged, box }, ... } for the views that differ
export function compareShots(clean, seeded, options) {
  const out = {};
  for (const view of Object.keys(clean)) {
    const result = comparePngs(clean[view], seeded[view], options);
    if (result.diffPixels > 0 || result.sizeChanged) {
      const { diffPixels, diffPercent, sizeChanged, box } = result;
      out[view] = { diffPixels, diffPercent, sizeChanged, box };
    }
  }
  return out;
}

export function summarize(differing) {
  const views = Object.keys(differing);
  const at = (viewport) => views.filter((v) => v.endsWith(`@${viewport}`)).map((v) => v.split('@')[0]);
  return {
    desktop: at('desktop').length > 0,
    mobile: at('mobile').length > 0,
    desktopPages: at('desktop'),
    mobilePages: at('mobile'),
    maxDiffPercent: Math.max(0, ...Object.values(differing).map((d) => d.diffPercent)),
  };
}

export async function measureVisibility({ benchRoot = REPO_ROOT, ids } = {}) {
  const appDir = path.join(benchRoot, 'app');
  const tasks = ids ?? fs.readdirSync(path.join(benchRoot, 'tasks')).sort();
  const browser = await chromium.launch();
  const result = {};
  try {
    const clean = await screenshots(browser, appDir);
    for (const id of tasks) {
      const ws = makeWorkspace({ appDir, patches: [path.join(benchRoot, 'tasks', id, 'seed.patch')], label: 'vis' });
      try {
        const seeded = await screenshots(browser, ws);
        // 0.2 is Playwright's default threshold for toHaveScreenshot()
        const differing = compareShots(clean, seeded, { threshold: 0.2 });
        result[id] = { ...summarize(differing), views: differing };
      } finally {
        removeWorkspace(ws);
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}

async function main() {
  const ids = process.argv.slice(2);
  const result = await measureVisibility({ ids: ids.length > 0 ? ids : undefined });
  for (const [id, r] of Object.entries(result)) {
    console.log(`${id}  desktop: ${r.desktop ? r.desktopPages.join(',') : 'no'}  phone: ${r.mobile ? r.mobilePages.join(',') : 'no'}  max ${r.maxDiffPercent}%`);
    if (ids.length > 0) {
      for (const [view, d] of Object.entries(r.views)) console.log(`    ${view}  ${d.diffPixels}px (${d.diffPercent}%)${d.sizeChanged ? '  size changed' : ''}  box ${JSON.stringify(d.box)}`);
    }
  }
  if (ids.length === 0) {
    const file = path.join(REPO_ROOT, 'oracle', 'visibility.json');
    // measuredOn ties the file to the app and seeds it was measured on (checked by npm test)
    fs.writeFileSync(file, `${JSON.stringify({ measuredOn: seedsHash(REPO_ROOT), threshold: 0.2, tasks: result }, null, 2)}\n`);
    console.log(`wrote ${path.relative(REPO_ROOT, file)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
