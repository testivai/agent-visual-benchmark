// Study 2's validity filters (study2/PREREGISTRATION.md, section 4): a mutation
// is kept only if it changes at least one measured property of a rendered
// element in a captured view, and at least one pixel of a captured screenshot.
// Both look at the page only, measured by the oracle's own capture, never at
// either tool's verdict.
import fs from 'node:fs';
import path from 'node:path';
import { captureSnapshot } from '../oracle/lib/capture.mjs';
import { diffSnapshots } from '../oracle/lib/compare.mjs';
import { comparePngs } from '../harness/pixels.mjs';
import { startStaticServer } from '../harness/static-server.mjs';
import { withTempDir } from '../runner/tempdir.mjs';

// Every page at desktop and mobile size. Study 2's sites have no states to reach.
export const siteViews = (pages) => pages.flatMap((page) => ['desktop', 'mobile'].map((viewport) => ({ page, viewport })));

const rendered = (e) => Boolean(e) && e.w > 0 && e.h > 0 && e.vis > 0 && e.visibility !== 'hidden';

function counts(clean, after, entry) {
  const [view, key, field] = entry.split('|');
  if (key === '@view') return false;
  if (key === '@doc') return field === 'scrollW' || field === 'scrollH';
  return rendered(clean.views[view]?.elements?.[key]) || rendered(after.views[view]?.elements?.[key]);
}

// The oracle's differences that are on an element rendered before or after, or
// in the size of the page.
export function renderedChanges(clean, after) {
  return diffSnapshots(clean, after).filter((entry) => counts(clean, after, entry));
}

const viewErrors = (snapshot) => Object.entries(snapshot.views).filter(([, v]) => v.error).map(([id, v]) => `${id}: ${v.error}`);

function pixelsOf(a, b) {
  if (!a || !b) return null;
  return { any: comparePngs(a, b, { threshold: 0 }).diffPixels, atDefault: comparePngs(a, b).diffPixels };
}

// measured: rendered changes; pixels: per view, the pixels that differ at all
// (any) and at Playwright's default threshold (atDefault); errors: views not captured.
export function effectOf(clean, after) {
  const shots = clean.screenshots ?? {};
  const pixels = Object.fromEntries(Object.keys(shots).map((id) => [id, pixelsOf(shots[id], after.screenshots?.[id])]));
  return { measured: renderedChanges(clean, after), pixels, errors: viewErrors(after) };
}

export const shows = (effect) => effect.errors.length === 0
  && effect.measured.length > 0
  && Object.values(effect.pixels).some((p) => p && p.any > 0);

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
