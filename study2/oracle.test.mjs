import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { scopeOf, judge, partialCredit } from './oracle.mjs';
import { parseRules } from './css.mjs';
import { applyMutations } from './mutate.mjs';
import { siteViews, captureSite } from './validity.mjs';
import { withTempDir } from '../runner/tempdir.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const el = (o = {}) => ({ x: 0, y: 0, w: 10, h: 10, vis: 1, visibility: 'visible', color: 'rgb(0, 0, 0)', ...o });
const DOC = { title: 'T', scrollW: 1280, scrollH: 900, fonts: '' };
const snap = (elements, doc = DOC) => ({ views: { 'index.html@desktop': { doc, elements } } });
const RED = { color: 'rgb(255, 0, 0)' };

test('the scope is what the seed changed on rendered elements: all of it must be restored', () => {
  const clean = snap({ '.a[0]': el(), '.hidden[0]': el({ w: 0, h: 0 }) });
  const seeded = snap({ '.a[0]': el(RED), '.hidden[0]': el({ w: 0, h: 0, ...RED }) });
  assert.deepEqual([...scopeOf(clean, seeded).mustRestore], ['index.html@desktop|.a[0]|color']);
});

test('judged: restored, and nothing else rendered changed', () => {
  const clean = snap({ '.a[0]': el(), '.b[0]': el(), '.hidden[0]': el({ w: 0, h: 0 }) });
  const seeded = snap({ '.a[0]': el(RED), '.b[0]': el(), '.hidden[0]': el({ w: 0, h: 0 }) });
  const v = (actual) => judge({ clean, seeded, actual });

  assert.equal(v(clean).success, true, 'the clean site is a fix');
  assert.equal(v(snap({ '.a[0]': el(), '.b[0]': el({ y: 0.3 }), '.hidden[0]': el({ w: 0, h: 0 }) })).success, true, 'within the tolerance');
  assert.equal(v(snap({ '.a[0]': el(), '.b[0]': el(), '.hidden[0]': el({ w: 0, h: 0, ...RED }) })).success, true, 'an element never rendered is not judged');

  const left = v(seeded);
  assert.equal(left.success, false);
  assert.deepEqual(left.notRestored, [{ entry: 'index.html@desktop|.a[0]|color', expected: 'rgb(0, 0, 0)', actual: 'rgb(255, 0, 0)' }]);
  assert.deepEqual(left.collateral, []);

  const broke = v(snap({ '.a[0]': el(), '.b[0]': el(RED), '.hidden[0]': el({ w: 0, h: 0 }) }));
  assert.equal(broke.success, false);
  assert.deepEqual(broke.notRestored, []);
  assert.deepEqual(broke.collateral.map((c) => c.entry), ['index.html@desktop|.b[0]|color']);

  const shown = v(snap({ '.a[0]': el(), '.b[0]': el(), '.hidden[0]': el() }));
  assert.deepEqual(shown.collateral.map((c) => c.entry), ['index.html@desktop|.hidden[0]|h', 'index.html@desktop|.hidden[0]|w'], 'an element the fix shows is judged');

  const titled = v(snap({ '.a[0]': el(), '.b[0]': el(), '.hidden[0]': el({ w: 0, h: 0 }) }, { ...DOC, title: 'U' }));
  assert.deepEqual(titled.collateral.map((c) => c.entry), ['index.html@desktop|@doc|title'], 'the page itself is always judged');
});

test('a decoy, where nothing was seeded: success is changing nothing rendered', () => {
  const clean = snap({ '.a[0]': el() });
  assert.equal(judge({ clean, seeded: clean, actual: clean }).success, true);
  assert.equal(judge({ clean, seeded: clean, actual: snap({ '.a[0]': el(RED) }) }).success, false);
});

test('partial credit: the share of the mutations whose own changes are all restored', () => {
  const clean = snap({ '.a[0]': el(), '.b[0]': el(), '.c[0]': el() });
  const singles = [
    snap({ '.a[0]': el(RED), '.b[0]': el(), '.c[0]': el() }),
    snap({ '.a[0]': el(), '.b[0]': el(RED), '.c[0]': el() }),
    snap({ '.a[0]': el(), '.b[0]': el(), '.c[0]': el(RED) }),
  ];
  const actual = snap({ '.a[0]': el(), '.b[0]': el(RED), '.c[0]': el() });
  assert.deepEqual(partialCredit({ clean, singles, actual }), { restored: 2, of: 3, share: 2 / 3, each: [true, false, true] });
});

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('on a drawn site: any fix that measures as the clean site passes, however it is written', async () => {
  const site = path.join(HERE, 'sites', 'bare', 'site');
  const cssFile = path.join('css', 'styles.css');
  const css = fs.readFileSync(path.join(site, cssFile), 'utf8');
  const rules = parseRules(css);
  const decl = (selector, property) => rules.find((r) => r.selector === selector && r.media === null).declarations.find((d) => d.property === property);
  const views = siteViews(['index.html']);
  const seededCss = applyMutations(css, [{ ...decl('.lead', 'font-size'), to: '1.875rem' }]);
  const measure = (text) => withTempDir('avb-s2-oracle-', async (dir) => {
    fs.cpSync(site, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, cssFile), text);
    return captureSite(browser, dir, views);
  });
  const clean = await captureSite(browser, site, views);
  const seeded = await measure(seededCss);

  const unfixed = judge({ clean, seeded, actual: seeded });
  assert.equal(unfixed.success, false);
  assert.ok(unfixed.notRestored.some((v) => /\|\.lead\[0\]\|fontSize$/.test(v.entry)));

  assert.equal(judge({ clean, seeded, actual: await measure(css) }).success, true, 'the seed reverted');
  assert.equal(judge({ clean, seeded, actual: await measure(`${seededCss}\n.lead { font-size: 1.25rem; }\n`) }).success, true, 'an override at the end');

  const collateral = judge({ clean, seeded, actual: await measure(applyMutations(css, [{ ...decl('.mt-5', 'margin-top'), to: '1rem !important' }])) });
  assert.equal(collateral.success, false, 'fixed, but something else moved');
  assert.ok(collateral.collateral.some((v) => v.entry === 'index.html@desktop|.lead[0]|y'), 'the lead moved, which the seed did not do');
  assert.ok(collateral.notRestored.every((v) => /\|y$/.test(v.entry)), 'what the seed moved was moved again, elsewhere');
});
