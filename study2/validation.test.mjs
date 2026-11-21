import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { setProblems, taskProblems } from './validation.mjs';
import { STRATA, strataForRung } from './generate.mjs';
import { parseRules } from './css.mjs';
import { captureSite, siteViews } from './validity.mjs';
import { DRIFT_SETTINGS, withDriftBrowser } from './drift.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const CSS = `.a { color: #0d6efd; padding: 1rem; }
.b { margin: 1rem; font-weight: 700; }`;
const RULES = parseRules(CSS);
const mut = (rule, property, to) => {
  const d = RULES[rule].declarations.find((x) => x.property === property);
  return { ruleId: rule, property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
};
const SMALL = { S1: { ...STRATA.S1, tasks: 1 }, S2: { ...STRATA.S2, tasks: 1 }, S4: { ...STRATA.S4, tasks: 1 } };
const good = () => [
  { id: 's2t01', stratum: 'S2', site: 'x', drift: false, mutations: [mut(0, 'color', '#fd9c0d'), mut(1, 'margin', '1.5rem')] },
  { id: 's2t02', stratum: 'S1', site: 'x', drift: false, mutations: [mut(0, 'padding', '0.5rem')] },
  { id: 's2t03', stratum: 'S4', site: 'x', drift: true, mutations: [] },
];

test('the set: strata counts, drift flags, mutation counts, ids, and every mutation still where it was recorded', () => {
  const css = { x: CSS };
  assert.deepEqual(setProblems(good(), { strata: SMALL, css }), []);

  const t = good();
  t[1].mutations[0].from = '2rem';
  assert.deepEqual(setProblems(t, { strata: SMALL, css }), ['s2t02: .a padding is "1rem" in the stylesheet, not "2rem" as recorded']);

  const u = good();
  u[2].drift = false;
  u[1].mutations.push(mut(1, 'font-weight', '400'));
  assert.deepEqual(setProblems(u, { strata: SMALL, css }), ['s2t02: 2 mutations, S1 has 1', 's2t03: drift false, S4 has drift true']);

  const v = good();
  v[1].mutations = [mut(1, 'margin', '0.5rem')];
  v[0].id = 's2t02';
  assert.deepEqual(setProblems(v, { strata: SMALL, css }), [
    'ids: s2t02 appears 2 times',
    'x: the declaration at 51 is mutated by more than one task (s2t02, s2t02)',
  ]);

  const w = good();
  w[0].mutations[1] = mut(0, 'padding', '2rem');
  assert.deepEqual(setProblems(w, { strata: SMALL, css }), [
    's2t01: two mutations on one rule (0)',
    'x: the declaration at 30 is mutated by more than one task (s2t01, s2t02)',
  ]);

  assert.deepEqual(setProblems(good().slice(0, 2), { strata: SMALL, css }), ['S4: 0 tasks, not 1']);
  const same = good();
  same[1].mutations[0].to = '1rem';
  assert.deepEqual(setProblems(same, { strata: SMALL, css }), ['s2t02: .a padding is "1rem" before and after']);
});

test('the set is checked against the rung it was generated at', () => {
  const r1 = strataForRung(1);
  const small = { S1: { ...r1.S1, tasks: 1 }, S2: { ...r1.S2, tasks: 1 }, S4: { ...r1.S4, tasks: 1 } };
  const set = [
    { id: 's2t01', stratum: 'S2', site: 'x', drift: false, mutations: [mut(0, 'color', '#fd9c0d'), mut(1, 'margin', '1.5rem'), mut(1, 'font-weight', '400')] },
    { id: 's2t02', stratum: 'S1', site: 'x', drift: false, mutations: [mut(0, 'padding', '0.5rem')] },
    { id: 's2t03', stratum: 'S4', site: 'x', drift: true, mutations: [] },
  ];
  set[0].mutations[2].ruleId = 1;
  const problems = setProblems(set, { strata: small, css: { x: CSS } });
  assert.ok(problems.includes('s2t02: 1 mutation, S1 has 2'), problems.join('\n'));
});

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('each task, on a drawn site: the seed fails the oracle, reverting it passes, it shows to both arms; drift is pure', async () => {
  const siteDir = path.join(HERE, 'sites', 'bare', 'site');
  const cssFile = path.join('css', 'styles.css');
  const css = fs.readFileSync(path.join(siteDir, cssFile), 'utf8');
  const rules = parseRules(css);
  const at = (selector, property, to) => {
    const r = rules.find((x) => x.selector === selector && x.media === null);
    const d = r.declarations.find((x) => x.property === property);
    return { ruleId: r.id, selector, property, from: d.value, to, valueStart: d.valueStart, valueEnd: d.valueEnd };
  };
  const views = siteViews(['index.html']);
  const clean = await captureSite(browser, siteDir, views);
  const drifted = await withDriftBrowser(DRIFT_SETTINGS[0], (b) => captureSite(b, siteDir, views));
  const site = { siteDir, cssFile, pages: ['index.html'], clean, drifted };
  const check = (task) => taskProblems(browser, { task, ...site });

  assert.deepEqual(await check({ id: 'a', stratum: 'S1', drift: false, mutations: [at('.lead', 'font-size', '1.875rem')] }), []);
  assert.deepEqual(await check({ id: 'b', stratum: 'S2', drift: false, mutations: [at('.lead', 'font-size', '1.875rem'), at('.mt-5', 'margin-top', '1rem !important')] }), []);
  assert.deepEqual(await check({ id: 'c', stratum: 'S3', drift: true, mutations: [at('.lead', 'font-size', '1.875rem')] }), []);
  assert.deepEqual(await check({ id: 'd', stratum: 'S4', drift: true, mutations: [] }), []);

  assert.deepEqual(await check({ id: 'e', stratum: 'S1', drift: false, mutations: [at('.dropdown-divider', 'opacity', '0.3')] }), [
    'e: the seeded site passes the oracle',
    'e: the seed no longer shows (no measured change on a rendered element)',
  ]);
  const half = await check({ id: 'f', stratum: 'S2', drift: false, mutations: [at('.lead', 'font-size', '1.875rem'), at('.dropdown-divider', 'opacity', '0.3')] });
  assert.deepEqual(half, ['f: mutation 2 (.dropdown-divider opacity) does not show on its own (no measured change on a rendered element)']);
});
