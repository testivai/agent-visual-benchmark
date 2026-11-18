import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { siteViews, renderedChanges, captureSite, effectOf, mutationEffect, shows } from './validity.mjs';
import { parseRules } from './css.mjs';
import { applyMutations } from './mutate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('the views of a site: every page at desktop and mobile size', () => {
  assert.deepEqual(siteViews(['index.html', 'about.html']), [
    { page: 'index.html', viewport: 'desktop' }, { page: 'index.html', viewport: 'mobile' },
    { page: 'about.html', viewport: 'desktop' }, { page: 'about.html', viewport: 'mobile' },
  ]);
});

const el = (o = {}) => ({ x: 0, y: 0, w: 10, h: 10, vis: 1, visibility: 'visible', color: 'rgb(0, 0, 0)', ...o });
const DOC = { title: 'T', scrollW: 1280, scrollH: 900, fonts: '' };
const snap = (elements, doc = DOC) => ({ views: { 'index.html@desktop': { doc, elements } } });

test('measured changes count only on an element rendered before or after: a box, not clipped away, not hidden', () => {
  const red = { color: 'rgb(255, 0, 0)' };
  assert.deepEqual(renderedChanges(snap({ '.a[0]': el() }), snap({ '.a[0]': el(red) })), ['index.html@desktop|.a[0]|color']);
  assert.deepEqual(renderedChanges(snap({ '.a[0]': el({ w: 0, h: 0 }) }), snap({ '.a[0]': el({ w: 0, h: 0, ...red }) })), [], 'no box');
  assert.deepEqual(renderedChanges(snap({ '.a[0]': el({ vis: 0 }) }), snap({ '.a[0]': el({ vis: 0, ...red }) })), [], 'clipped away');
  assert.deepEqual(renderedChanges(snap({ '.a[0]': el({ visibility: 'hidden' }) }), snap({ '.a[0]': el({ visibility: 'hidden', ...red }) })), [], 'hidden');
  assert.deepEqual(
    renderedChanges(snap({ '.menu[0]': el({ w: 0, h: 0 }) }), snap({ '.menu[0]': el() })),
    ['index.html@desktop|.menu[0]|h', 'index.html@desktop|.menu[0]|w'],
    'shown by the mutation',
  );
  assert.deepEqual(renderedChanges(snap({}), snap({ '.b[0]': el() })), ['index.html@desktop|.b[0]|@extra']);
  assert.deepEqual(renderedChanges(snap({ '.b[0]': el() }), snap({})), ['index.html@desktop|.b[0]|@exists']);
  assert.deepEqual(renderedChanges(snap({}), snap({}, { ...DOC, scrollH: 1200, title: 'U' })), ['index.html@desktop|@doc|scrollH'], 'the page height, not its title');
});

test('the effect of a mutation: measured changes, differing pixels per view, and views that could not be captured', () => {
  const clean = { ...snap({ '.a[0]': el() }), screenshots: {} };
  const broken = { views: { 'index.html@desktop': { error: 'could not load the index.html page: timeout' } }, screenshots: {} };
  const effect = effectOf(clean, broken);
  assert.deepEqual(effect.errors, ['index.html@desktop: could not load the index.html page: timeout']);
  assert.equal(shows(effect), false, 'a view that cannot be captured never counts as showing');
  assert.equal(shows({ measured: ['v|.a[0]|color'], pixels: { v: { any: 3, atDefault: 0 } }, errors: [] }), true);
  assert.equal(shows({ measured: ['v|.a[0]|color'], pixels: { v: { any: 0, atDefault: 0 } }, errors: [] }), false, 'no pixel');
  assert.equal(shows({ measured: [], pixels: { v: { any: 3, atDefault: 3 } }, errors: [] }), false, 'no measured change');
});

const DRAWN = ['agency', 'bare', 'full-width-pics', 'heroic-features', 'shop-item', 'small-business'];

test('each drawn site, captured twice, is identical in what is measured and in every pixel', async () => {
  for (const name of DRAWN) {
    const site = path.join(SITES, name, 'site');
    const views = siteViews(['index.html']);
    const a = await captureSite(browser, site, views);
    const b = await captureSite(browser, site, views);
    const effect = effectOf(a, b);
    assert.deepEqual(effect.errors, [], name);
    assert.deepEqual(effect.measured, [], name);
    assert.deepEqual(Object.keys(effect.pixels), ['index.html@desktop', 'index.html@mobile'], name);
    for (const [view, p] of Object.entries(effect.pixels)) assert.equal(p.any, 0, `${name} ${view}`);
  }
});

test('on a drawn site: a used rule whose change shows is kept; one that matches only a closed dropdown is not', async () => {
  const site = path.join(SITES, 'bare', 'site');
  const cssFile = path.join('css', 'styles.css');
  const css = fs.readFileSync(path.join(site, cssFile), 'utf8');
  const rules = parseRules(css);
  const views = siteViews(['index.html']);
  const clean = await captureSite(browser, site, views);
  const mutation = (selector, property, to) => {
    const d = rules.find((r) => r.selector === selector && r.media === null).declarations.find((x) => x.property === property);
    return { ...d, to };
  };

  const lead = await mutationEffect(browser, { siteDir: site, cssFile, css: applyMutations(css, [mutation('.lead', 'font-size', '1.875rem')]), views, clean });
  assert.equal(shows(lead), true, JSON.stringify(lead).slice(0, 300));
  assert.ok(lead.measured.some((e) => /\|\.lead\[0\]\|fontSize$/.test(e)), lead.measured.join('\n'));
  assert.ok(lead.pixels['index.html@desktop'].atDefault > 0);

  const divider = await mutationEffect(browser, { siteDir: site, cssFile, css: applyMutations(css, [mutation('.dropdown-divider', 'opacity', '0.3')]), views, clean });
  assert.equal(shows(divider), false, JSON.stringify(divider).slice(0, 300));
  assert.deepEqual(divider.measured, []);
  for (const p of Object.values(divider.pixels)) assert.equal(p.any, 0);
});
