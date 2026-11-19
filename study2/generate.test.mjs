import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { STRATA, allocate, drawTask, generateTasks, reasonOf, siteChecker, drawStats, siteState } from './generate.mjs';
import { CLASSES } from './mutate.mjs';
import { parseRules } from './css.mjs';
import { mulberry32 } from '../runner/rng.mjs';
import { applyMutations } from './mutate.mjs';
import { mutationEffect, shows, siteViews, captureSite } from './validity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = ['agency', 'bare', 'full-width-pics', 'heroic-features', 'shop-item', 'small-business'];

test('the strata: 72 tasks; one mutation in S1 and S3, two or three in S2, none in the S4 decoys; drift in S3 and S4', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(STRATA).map(([k, s]) => [k, s.tasks])), { S1: 20, S2: 20, S3: 20, S4: 12 });
  assert.deepEqual(Object.fromEntries(Object.entries(STRATA).map(([k, s]) => [k, s.drift])), { S1: false, S2: false, S3: true, S4: true });
  const counts = (k) => new Set(Array.from({ length: 200 }, (_, i) => STRATA[k].mutations(mulberry32(i))));
  assert.deepEqual([...counts('S1')], [1]);
  assert.deepEqual([...counts('S2')].sort(), [2, 3]);
  assert.deepEqual([...counts('S3')], [1]);
  assert.deepEqual([...counts('S4')], [0]);
  for (const k of Object.keys(STRATA)) assert.deepEqual([...counts(k)].sort(), STRATA[k].counts, `${k}: the counts listed are the counts drawn`);
});

test('allocation: each stratum spread evenly over the sites in a seeded order; ids in a seeded order that hides the stratum', () => {
  const slots = allocate(STRATA, SITES, 7);
  assert.equal(slots.length, 72);
  assert.deepEqual(slots.map((s) => s.id), Array.from({ length: 72 }, (_, i) => `s2t${String(i + 1).padStart(2, '0')}`));
  for (const [k, s] of Object.entries(STRATA)) {
    const per = SITES.map((site) => slots.filter((x) => x.stratum === k && x.site === site).length);
    assert.equal(per.reduce((a, b) => a + b), s.tasks, k);
    assert.ok(Math.max(...per) - Math.min(...per) <= 1, `${k}: ${per}`);
  }
  for (const site of SITES) assert.equal(slots.filter((x) => x.site === site).length, 12, `${site}: 72 tasks over 6 sites`);
  assert.deepEqual(allocate(STRATA, SITES, 7), slots, 'the same seed, the same allocation');
  assert.notDeepEqual(allocate(STRATA, SITES, 8), slots);
  assert.ok(new Set(slots.slice(0, 20).map((s) => s.stratum)).size > 1, 'the first ids are not all one stratum');
});

const CSS = `.a { color: #0d6efd; padding: 1rem; }
.b { margin: 0 auto; font-weight: 700; }
.c { display: flex; padding: 2px; }
.d { color: #000; }`;
const RULES = parseRules(CSS);
const USED = new Set([0, 1, 2, 3]);
const effect = (ok) => ({ measured: ok ? ['v|.a[0]|color'] : [], pixels: { v: { any: ok ? 5 : 0, playwright: ok, testivai: ok ? 5 : 0 } }, errors: [] });

test('why a candidate is rejected, in words', () => {
  assert.equal(reasonOf({ measured: [], pixels: {}, errors: ['v: could not load'] }), 'a view could not be captured');
  assert.equal(reasonOf(effect(false)), 'no measured change on a rendered element');
  const measured = ['v|.a[0]|color'];
  const px = (any, playwright, testivai) => ({ measured, pixels: { v: { any, playwright, testivai } }, errors: [] });
  assert.equal(reasonOf(px(0, false, 0)), 'no pixel changed');
  assert.equal(reasonOf(px(4, false, 0)), 'neither arm\'s check flags it');
  assert.equal(reasonOf(px(4, false, 4)), 'arm B\'s check (Playwright) does not flag it');
  assert.equal(reasonOf(px(4, true, 0)), 'arm C\'s check (TestivAI) does not flag it');
});

test('a task: the class from the site\'s deck; its candidates in random order until one shows; a class with none that shows is dead on the site', async () => {
  const check = async (ms) => effect(ms.every((m) => m.property === 'padding'));
  for (let seed = 1; seed <= 10; seed++) {
    const site = siteState(seed);
    const { mutations, rejected } = await drawTask({ rules: RULES, used: USED, count: 1, random: mulberry32(seed), skip: new Set(), check, site });
    assert.equal(mutations.length, 1);
    assert.equal(mutations[0].property, 'padding');
    assert.ok(mutations[0].effect.pixels.v.any > 0, 'the effect is kept with the mutation');
    assert.ok(!site.deck.includes('padding'), 'the class is used up for this round');
    assert.ok(!site.dead.has('padding'));
    for (const r of rejected) {
      assert.notEqual(r.property, 'padding');
      assert.equal(r.reason, 'no measured change on a rendered element');
      assert.ok(site.dead.has(r.class), `${r.class}: every candidate failed, so it is dead on the site`);
    }
  }
});

const EVEN = [
  ['color', '#112233'], ['background-color', '#445566'], ['font-size', '1rem'], ['font-weight', '700'], ['letter-spacing', '1px'],
  ['line-height', '1.5'], ['margin', '1rem'], ['padding', '1rem'], ['width', '50%'], ['display', 'flex'],
  ['position', 'relative'], ['border', '1px solid #000'], ['opacity', '1'], ['overflow', 'hidden'], ['text-transform', 'uppercase'],
];
const EVEN_RULES = parseRules(EVEN.flatMap(([p, v], i) => [`.k${i}a { ${p}: ${v}; }`, `.k${i}b { ${p}: ${v}; }`]).join('\n'));
const EVEN_USED = new Set(EVEN_RULES.map((r) => r.id));
const ones = (tasks) => ({ S1: { tasks, drift: false, counts: [1], mutations: () => 1 } });
const tally = (tasks) => tasks.flatMap((t) => t.mutations.map((m) => m.class)).reduce((o, c) => ({ ...o, [c]: (o[c] ?? 0) + 1 }), {});

test('an even mix: where every class can show, each class once per round of the deck', async () => {
  const sites = { x: { rules: EVEN_RULES, used: EVEN_USED } };
  const fifteen = await generateTasks({ sites, strata: ones(15), seed: 3, check: async () => effect(true) });
  assert.deepEqual(tally(fifteen.tasks), Object.fromEntries(Object.keys(CLASSES).map((c) => [c, 1])));
  const thirty = await generateTasks({ sites, strata: ones(30), seed: 3, check: async () => effect(true) });
  assert.deepEqual(tally(thirty.tasks), Object.fromEntries(Object.keys(CLASSES).map((c) => [c, 2])));
});

test('a class that cannot show on a site is tried once, then skipped there; the record says which classes died', async () => {
  const sites = { x: { rules: EVEN_RULES, used: EVEN_USED } };
  const check = async (site, ms) => effect(ms.every((m) => m.class !== 'colour'));
  const { tasks, dead } = await generateTasks({ sites, strata: ones(15), seed: 4, check });
  const counts = tally(tasks);
  assert.equal(counts.colour, undefined);
  assert.equal(Object.keys(counts).length, 14, 'every other class in the first round');
  assert.equal(Object.values(counts).reduce((a, b) => a + b), 15, 'and one of them again in the next');
  assert.equal(tasks.flatMap((t) => t.rejected).filter((r) => r.class === 'colour').length, 2, 'its two candidates, each checked once');
  assert.deepEqual(dead, { x: ['colour'] });
});

test('several mutations: each shows on its own, on different rules, and together; a pair that cancels out is drawn again', async () => {
  let together = 0;
  const check = async (ms) => {
    if (ms.length > 1) together += 1;
    return effect(ms.length === 1 || together > 1);
  };
  const { mutations, rejected } = await drawTask({ rules: RULES, used: USED, count: 2, random: mulberry32(3), skip: new Set(), check, site: siteState(3) });
  assert.equal(mutations.length, 2);
  assert.equal(new Set(mutations.map((m) => m.ruleId)).size, 2);
  assert.equal(together, 2, 'the first pair did not show together, the second did');
  const dropped = rejected.filter((r) => r.reason === 'does not show together with the others');
  assert.equal(dropped.length, 1);
  assert.ok(!mutations.some((m) => m.valueStart === dropped[0].valueStart), 'the dropped one is not drawn again');
});

test('a task fails loudly when no class can still show on the site, or after a bounded number of candidates', async () => {
  const never = async () => effect(false);
  await assert.rejects(
    drawTask({ rules: RULES, used: USED, count: 1, random: mulberry32(1), skip: new Set(), check: never, site: siteState(1) }),
    /no class can still produce a change that shows on this site/,
  );
  await assert.rejects(
    drawTask({ rules: EVEN_RULES, used: EVEN_USED, count: 1, random: mulberry32(1), skip: new Set(), check: never, site: siteState(1), maxCandidates: 3 }),
    /no mutation that shows after 3 candidates/,
  );
});

test('all tasks: the counts of each stratum, no declaration mutated twice on a site, reproducible from the seed', async () => {
  const sites = Object.fromEntries(['x', 'y'].map((name) => [name, { rules: RULES, used: USED }]));
  const strata = {
    S1: { ...STRATA.S1, tasks: 2 }, S2: { ...STRATA.S2, tasks: 2 }, S3: { ...STRATA.S3, tasks: 2 }, S4: { ...STRATA.S4, tasks: 2 },
  };
  const check = async () => effect(true);
  const a = await generateTasks({ sites, strata, seed: 5, check });
  assert.equal(a.tasks.length, 8);
  for (const t of a.tasks) {
    assert.equal(t.drift, strata[t.stratum].drift);
    if (t.stratum === 'S4') assert.deepEqual(t.mutations, []);
    else if (t.stratum === 'S2') assert.ok([2, 3].includes(t.mutations.length));
    else assert.equal(t.mutations.length, 1);
  }
  for (const site of ['x', 'y']) {
    const starts = a.tasks.filter((t) => t.site === site).flatMap((t) => t.mutations.map((m) => m.valueStart));
    assert.equal(new Set(starts).size, starts.length, site);
  }
  assert.deepEqual(await generateTasks({ sites, strata, seed: 5, check }), a);
});

test('draw statistics: per class, the mutations kept and the candidates rejected, by reason; a candidate checked again counts once', () => {
  const again = { class: 'opacity', reason: 'no pixel changed', valueStart: 5, to: '0.3' };
  const tasks = [
    { site: 'x', mutations: [{ class: 'colour' }], rejected: [again, { class: 'colour', reason: 'no pixel changed', valueStart: 9, to: '#000000' }] },
    { site: 'x', mutations: [{ class: 'colour' }, { class: 'margin' }], rejected: [{ class: 'opacity', reason: 'no measured change on a rendered element', valueStart: 7, to: '1' }, again] },
    { site: 'y', mutations: [], rejected: [again] },
    { site: 'x', mutations: [], rejected: [] },
  ];
  assert.deepEqual(drawStats(tasks), {
    candidates: 7,
    kept: 3,
    byClass: {
      colour: { kept: 2, rejected: { 'no pixel changed': 1 } },
      margin: { kept: 1, rejected: {} },
      opacity: { kept: 0, rejected: { 'no pixel changed': 2, 'no measured change on a rendered element': 1 } },
    },
  });
});

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('on a drawn site, with the real check: every kept mutation shows when checked again from scratch', async () => {
  const siteDir = path.join(HERE, 'sites', 'bare', 'site');
  const cssFile = path.join('css', 'styles.css');
  const css = fs.readFileSync(path.join(siteDir, cssFile), 'utf8');
  const checker = await siteChecker(browser, { siteDir, cssFile, pages: ['index.html'] });
  assert.ok(checker.used.size > 0);
  const { tasks } = await generateTasks({
    sites: { bare: checker },
    strata: { S1: { ...STRATA.S1, tasks: 1 }, S2: { ...STRATA.S2, tasks: 1 } },
    seed: 11,
    check: (site, ms) => checker.check(ms),
  });
  const views = siteViews(['index.html']);
  const clean = await captureSite(browser, siteDir, views);
  for (const t of tasks) {
    const again = await mutationEffect(browser, { siteDir, cssFile, css: applyMutations(css, t.mutations), views, clean });
    assert.ok(shows(again), `${t.id}: ${JSON.stringify(t.mutations.map((m) => [m.selector, m.property, m.from, m.to]))}`);
  }
});
