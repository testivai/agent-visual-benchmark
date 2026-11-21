import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { DRIFT_SETTINGS, fontconfigText, driftProblems, chooseDrift } from './drift.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('the settings tried, in a fixed order: font rendering first, then the rasteriser', () => {
  assert.deepEqual(DRIFT_SETTINGS.map((s) => s.name), [
    'font-hinting-full', 'font-antialias-off', 'no-subpixel-positioning', 'angle-swiftshader',
  ]);
  for (const s of DRIFT_SETTINGS) assert.ok(Boolean(s.fontconfig) !== Boolean(s.args), `${s.name}: a font setting or browser flags, not both`);
});

test('a font setting is the machine\'s own fontconfig with one rule added', () => {
  const text = fontconfigText('<match target="font"><edit name="antialias" mode="assign"><bool>false</bool></edit></match>');
  assert.match(text, /^<\?xml version="1.0"\?>/);
  assert.match(text, /<include ignore_missing="no">\/etc\/fonts\/fonts\.conf<\/include><match target="font">/);
});

const el = (o = {}) => ({ x: 0, y: 0, w: 10, h: 10, text: 'Hi', tx: 1, ty: 1, tw: 8, th: 8, vis: 1, top: 1, color: 'rgb(0, 0, 0)', ...o });
const DOC = { title: 'T', scrollW: 1280, scrollH: 900, fonts: '' };
const snap = (elements, doc = DOC) => ({ views: { 'index.html@desktop': { doc, elements } } });
const FLAGGED = { 'index.html@desktop': { any: 9, playwright: true, testivai: 9 } };

test('drift: every view flagged by both arms\' checks; geometry may move; the DOM and computed styles may not change', () => {
  const clean = snap({ '.a[0]': el() });
  assert.deepEqual(driftProblems(clean, snap({ '.a[0]': el({ x: 3, tw: 9, top: 2 }) }, { ...DOC, scrollH: 910 }), FLAGGED), []);
  assert.deepEqual(driftProblems(clean, snap({ '.a[0]': el({ color: 'rgb(1, 0, 0)' }) }), FLAGGED), [
    'computed styles differ: index.html@desktop|.a[0]|color',
  ]);
  assert.deepEqual(driftProblems(clean, snap({ '.a[0]': el({ text: 'Ho' }) }), FLAGGED), ['the DOM differs: index.html@desktop|.a[0]|text']);
  assert.deepEqual(driftProblems(clean, snap({}), FLAGGED), ['the DOM differs: index.html@desktop|.a[0]|@exists']);
  assert.deepEqual(driftProblems(clean, clean, { 'index.html@desktop': { any: 9, playwright: false, testivai: 9 } }), [
    'index.html@desktop: arm B\'s check does not flag it',
  ]);
  assert.deepEqual(driftProblems(clean, clean, { 'index.html@desktop': { any: 0, playwright: false, testivai: 0 } }), [
    'index.html@desktop: arm B\'s check does not flag it',
    'index.html@desktop: arm C\'s check does not flag it',
  ]);
  const broken = { views: { 'index.html@desktop': { error: 'could not load the index.html page: timeout' } } };
  assert.deepEqual(driftProblems(clean, broken, { 'index.html@desktop': null }), ['index.html@desktop: could not load the index.html page: timeout']);
});

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('the choice: the first setting that drifts every view of every site; the ones before it are recorded with why not', async () => {
  const nothing = { name: 'nothing', args: [] };
  const sites = [{ name: 'bare', siteDir: path.join(HERE, 'sites', 'bare', 'site'), pages: ['index.html'] }];
  const { chosen, tried } = await chooseDrift(browser, { sites, settings: [nothing, DRIFT_SETTINGS[0]] });
  assert.equal(chosen, 'font-hinting-full');
  assert.deepEqual(tried.map((t) => t.name), ['nothing', 'font-hinting-full']);
  assert.deepEqual(tried[0].problems.bare, [
    'index.html@desktop: arm B\'s check does not flag it', 'index.html@desktop: arm C\'s check does not flag it',
    'index.html@mobile: arm B\'s check does not flag it', 'index.html@mobile: arm C\'s check does not flag it',
  ]);
  assert.deepEqual(tried[1].problems.bare, []);
  for (const p of Object.values(tried[1].pixels.bare)) assert.ok(p.playwright && p.testivai > 0);
});
