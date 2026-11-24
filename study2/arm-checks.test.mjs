import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { playwrightCheck, testivaiCheck } from './arm-checks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function png(width, height, paint = () => [100, 100, 100]) {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = paint(x, y);
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

test('the checks are the code each arm runs, at the versions the arms install', () => {
  const armB = readJson(path.join(HERE, '..', 'arms', 'B', 'files', 'package.json')).devDependencies;
  const armC = readJson(path.join(HERE, '..', 'arms', 'C', 'files', 'package.json')).devDependencies;
  const installed = (name) => readJson(path.join(HERE, '..', 'node_modules', name, 'package.json')).version;
  assert.equal(installed('playwright-core'), armB['@playwright/test']);
  assert.equal(installed('@testivai/witness'), armC['@testivai/witness']);
});

test('identical screenshots: neither check flags them', () => {
  const a = png(64, 64);
  assert.equal(playwrightCheck(a, png(64, 64)).flagged, false);
  assert.deepEqual(testivaiCheck(a, png(64, 64)), { flagged: false, diffCount: 0 });
});

test('a block that changes colour: both checks flag it', () => {
  const block = png(64, 64, (x, y) => (x >= 20 && x < 40 && y >= 20 && y < 40 ? [250, 250, 250] : [100, 100, 100]));
  assert.equal(playwrightCheck(png(64, 64), block).flagged, true);
  assert.deepEqual(testivaiCheck(png(64, 64), block), { flagged: true, diffCount: 400 });
});

test('one pixel, 100 levels brighter: Playwright flags it; TestivAI reads it as identical (its summed luminance is under 0.5 × 256)', () => {
  const dot = png(64, 64, (x, y) => (x === 30 && y === 30 ? [200, 200, 200] : [100, 100, 100]));
  assert.equal(playwrightCheck(png(64, 64), dot).flagged, true);
  assert.deepEqual(testivaiCheck(png(64, 64), dot), { flagged: false, diffCount: 0 });
});

test('a page that grew: both checks flag it', () => {
  assert.equal(playwrightCheck(png(64, 64), png(64, 70)).flagged, true);
  const grown = testivaiCheck(png(64, 64), png(64, 70));
  assert.equal(grown.flagged, true);
  assert.equal(grown.diffCount, 64 * 6, 'the padded rows count as changed');
});
