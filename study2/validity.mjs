// Study 2's validity filters (study2/PREREGISTRATION.md, section 4): a mutation
// is kept only if it changes at least one measured property of a rendered
// element in a captured view, and its screenshots are flagged by both arms'
// own checks at their default settings (study2/arm-checks.mjs), each in at
// least one view. Neither check is more sensitive than the other in every
// case. The filters look at the page and at those two pixel comparisons only,
// never at TestivAI's analysis or any agent.
import fs from 'node:fs';
import path from 'node:path';
import { captureSnapshot } from '../oracle/lib/capture.mjs';
import { diffSnapshots } from '../oracle/lib/compare.mjs';
import { comparePngs } from '../harness/pixels.mjs';
import { playwrightCheck, testivaiCheck } from './arm-checks.mjs';
import { startStaticServer } from '../harness/static-server.mjs';
import { withTempDir } from '../runner/tempdir.mjs';
import { isRendered } from './oracle.mjs';

// Every page at desktop and mobile size. Study 2's sites have no states to reach.
export const siteViews = (pages) => pages.flatMap((page) => ['desktop', 'mobile'].map((viewport) => ({ page, viewport })));

function counts(clean, after, entry) {
  const [view, key, field] = entry.split('|');
  if (key === '@view') return false;
  if (key === '@doc') return field === 'scrollW' || field === 'scrollH';
  return isRendered(clean.views[view]?.elements?.[key]) || isRendered(after.views[view]?.elements?.[key]);
}

// The oracle's differences that are on an element rendered before or after, or
// in the size of the page.
export function renderedChanges(clean, after) {
  return diffSnapshots(clean, after).filter((entry) => counts(clean, after, entry));
}

const viewErrors = (snapshot) => Object.entries(snapshot.views).filter(([, v]) => v.error).map(([id, v]) => `${id}: ${v.error}`);

function pixelsOf(clean, after) {
  if (!clean || !after) return null;
  return {
    any: comparePngs(clean, after, { threshold: 0 }).diffPixels,
    playwright: playwrightCheck(clean, after).flagged,
    testivai: testivaiCheck(clean, after).diffCount,
  };
}

// measured: rendered changes; pixels: per view, the pixels that differ at all
// (any), whether arm B's check flags the view (playwright), and the pixels arm
// C's check counts (testivai); errors: views not captured.
export function effectOf(clean, after) {
  const shots = clean.screenshots ?? {};
  const pixels = Object.fromEntries(Object.keys(shots).map((id) => [id, pixelsOf(shots[id], after.screenshots?.[id])]));
  return { measured: renderedChanges(clean, after), pixels, errors: viewErrors(after) };
}

const views = (effect) => Object.values(effect.pixels).filter(Boolean);
export const flaggedByB = (effect) => views(effect).some((p) => p.playwright);
export const flaggedByC = (effect) => views(effect).some((p) => p.testivai > 0);

export const shows = (effect) => effect.errors.length === 0
  && effect.measured.length > 0
  && flaggedByB(effect)
  && flaggedByC(effect);

// The site's views, measured and screenshotted.
export async function captureSite(browser, siteDir, views) {
  const server = await startStaticServer(siteDir);
  try {
    return await captureSnapshot(browser, server.url, { views, screenshots: true });
  } finally {
    await server.close();
  }
}

// The effect of serving the site with cssFile (relative to siteDir) replaced by css.
export async function mutationEffect(browser, { siteDir, cssFile, css, views, clean }) {
  return withTempDir('avb-s2-mutant-', async (dir) => {
    fs.cpSync(siteDir, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, cssFile), css);
    return effectOf(clean, await captureSite(browser, dir, views));
  });
}
