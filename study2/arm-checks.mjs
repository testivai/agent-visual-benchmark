// Whether each arm's screenshot check, at its default settings, flags a
// difference between two screenshots. Each is the code that arm runs, at the
// version it installs (a test pins both):
// - arm B: Playwright's toHaveScreenshot comparator (pixelmatch at threshold
//   0.2; anti-aliased pixels skipped; any counted pixel fails);
// - arm C: TestivAI's pixel diff, called as its reporter calls it (threshold
//   0.1; anti-aliased pixels counted; a difference whose summed luminance is
//   0.5 × 256 or less reads as identical; a size change pads and counts).
// Neither is more sensitive than the other in every case, so study 2 keeps a
// change only when both flag it. Only the pixel comparison is used, never
// TestivAI's analysis of it.
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const { getComparator } = require('playwright-core/lib/coreBundle').utils;
const { diff } = require('@testivai/witness/diff');
const { getDefaultConfig } = require('@testivai/witness/config');

const comparePng = getComparator('image/png');

export function playwrightCheck(expected, actual) {
  const result = comparePng(actual, expected);
  return { flagged: result !== null, message: result?.errorMessage ?? null };
}

const copy = (data) => {
  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  return out;
};

export function testivaiCheck(baselineBuffer, candidateBuffer) {
  const baseline = PNG.sync.read(baselineBuffer);
  const candidate = PNG.sync.read(candidateBuffer);
  const sizeMismatch = baseline.width !== candidate.width || baseline.height !== candidate.height
    ? { baseline: { width: baseline.width, height: baseline.height }, candidate: { width: candidate.width, height: candidate.height } }
    : undefined;
  const out = new Uint8ClampedArray(Math.max(baseline.width, candidate.width) * Math.max(baseline.height, candidate.height) * 4);
  const result = diff(copy(baseline.data), copy(candidate.data), out, baseline.width, baseline.height, {
    threshold: getDefaultConfig().threshold,
    ...(sizeMismatch ? { handleSizeMismatch: 'pad', dimensions: sizeMismatch } : {}),
  });
  return { flagged: result.diffCount > 0, diffCount: result.diffCount };
}
