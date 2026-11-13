import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ARMS, armFiles, instructionsFor, visualLine } from './arms.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';
import { lintPrompt } from '../harness/lint.mjs';

const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const words = (s) => s.trim().split(/\s+/).length;

test('there are three arms: A blind, B pixel, C testivai', () => {
  assert.deepEqual(Object.keys(ARMS), ['A', 'B', 'C']);
  assert.equal(ARMS.A.visual, null);
  assert.equal(ARMS.B.visual, 'pixel');
  assert.equal(ARMS.C.visual, 'testivai');
});

test('the B and C instruction lines are the same length and shape', () => {
  const b = visualLine('B');
  const c = visualLine('C');
  assert.equal(words(b), words(c), `${b}\n${c}`);
  assert.ok(Math.abs(b.length - c.length) / b.length < 0.1, `${b.length} vs ${c.length} characters`);
  assert.match(b, /^- `npx playwright test tests\/visual\.spec\.ts` compares each page/);
  assert.match(c, /^- `npx playwright test tests\/visual\.spec\.ts` compares each page/);
  assert.equal(visualLine('A'), null);
});

test('every arm gets the same base instructions; B and C add one line, A none', () => {
  const [a, b, c] = ['A', 'B', 'C'].map(instructionsFor);
  const lines = (s) => s.split('\n');
  assert.equal(lines(b).length, lines(a).length + 1);
  assert.equal(lines(c).length, lines(a).length + 1);
  assert.deepEqual(lines(b).filter((l) => l !== visualLine('B')), lines(a));
  assert.deepEqual(lines(c).filter((l) => l !== visualLine('C')), lines(a));
  for (const text of [a, b, c]) {
    assert.match(text, /STATUS: DONE/);
    assert.match(text, /STATUS: NOT DONE/);
    assert.doesNotMatch(text, /\{\{/);
  }
});

test('no arm instructions describe a bug category or name a bug', () => {
  for (const arm of ['A', 'B', 'C']) {
    const categoryWords = lintPrompt(instructionsFor(arm)).filter((p) => /bug category/.test(p));
    assert.deepEqual(categoryWords, [], arm);
    assert.doesNotMatch(instructionsFor(arm), /\b(bug|regression|broken|seed|decoy|noise)\b/i, arm);
  }
});

test('A and B use the app\'s own package.json; C adds the pinned testivai packages', () => {
  const app = JSON.parse(read('app/package.json'));
  assert.deepEqual(JSON.parse(read('arms/A/files/package.json')), app);
  assert.deepEqual(JSON.parse(read('arms/B/files/package.json')), app);
  const c = JSON.parse(read('arms/C/files/package.json'));
  assert.deepEqual({ ...c, devDependencies: undefined }, { ...app, devDependencies: undefined });
  assert.deepEqual(c.devDependencies, {
    ...app.devDependencies,
    '@testivai/mcp': '0.9.4',
    '@testivai/witness': '2.7.2',
    '@testivai/witness-playwright': '2.1.3',
  });
});

test('every dependency is pinned to an exact version, and every arm has a lockfile that agrees', () => {
  for (const arm of ['A', 'B', 'C']) {
    const pkg = JSON.parse(read(`arms/${arm}/files/package.json`));
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${arm} ${name}@${version}`);
    }
    const lock = JSON.parse(read(`arms/${arm}/files/package-lock.json`));
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `${arm} lock ${name}`);
    }
  }
});

test('the file list of each arm: A has nothing visual, B screenshots, C testivai', () => {
  assert.deepEqual(armFiles('A'), ['package-lock.json', 'package.json']);
  assert.deepEqual(armFiles('B'), ['package-lock.json', 'package.json', 'playwright.config.ts', 'tests/visual.spec.ts']);
  assert.deepEqual(armFiles('C'), ['.testivai/config.json', 'package-lock.json', 'package.json', 'playwright.config.ts', 'tests/visual.spec.ts']);
});

test('B and C capture the same six pages at the same two sizes, with the tool\'s defaults', () => {
  const b = read('arms/B/files/tests/visual.spec.ts');
  const c = read('arms/C/files/tests/visual.spec.ts');
  const pages = (s) => [...s.matchAll(/\['(\w+)', '([^']+)'\]/g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(pages(b), pages(c));
  assert.equal(pages(b).length, 6);
  assert.match(b, /toHaveScreenshot\(`\$\{name\}\.png`, \{ fullPage: true \}\)/);
  assert.match(c, /witness\(page, testInfo, name\)/);
  const projects = (s) => s.match(/projects: \[[\s\S]*?\n  \]/)[0];
  assert.equal(projects(read('arms/B/files/playwright.config.ts')), projects(read('arms/C/files/playwright.config.ts')));
  assert.match(projects(read('arms/B/files/playwright.config.ts')), /width: 1280, height: 800/);
  assert.match(projects(read('arms/B/files/playwright.config.ts')), /width: 390, height: 844/);
  // C changes one default: the report must not try to open a browser window
  assert.deepEqual(JSON.parse(read('arms/C/files/.testivai/config.json')), { autoOpen: false });
});
