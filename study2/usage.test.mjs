import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { matchSelector, usedRules } from './usage.mjs';
import { parseRules } from './css.mjs';
import { withTempDir } from '../runner/tempdir.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

test('the selector matched is the rule selector without pseudo-elements, which no element matches', () => {
  assert.equal(matchSelector('.btn::before'), '.btn');
  assert.equal(matchSelector('p:first-line, h1:after'), 'p, h1', 'the old single-colon forms too');
  assert.equal(matchSelector('.form-control::-webkit-file-upload-button'), '.form-control');
  assert.equal(matchSelector('::placeholder'), '*', 'a pseudo-element on its own applies to every element');
  assert.equal(matchSelector('*, *::before, *::after'), '*, *, *');
  assert.equal(matchSelector('.list::marker:hover'), '.list:hover', 'pseudo-classes stay: a state the capture never reaches matches nothing');
  assert.equal(matchSelector('a[title="x::before"]'), 'a[title="x::before"]', 'quoted text is not a selector');
  assert.equal(matchSelector('.a:not(.b)::after'), '.a:not(.b)');
});

const CSS = `body { margin: 0; }
.card { padding: 1rem; }
.card::before { content: ""; }
.missing { color: red; }
a:hover { color: blue; }
@media (min-width: 992px) { .card { padding: 2rem; } }
@media (max-width: 575.98px) { .card { padding: 0.5rem; } }
@media print { .card { color: black; } }
@media (prefers-reduced-motion: no-preference) { .card { scroll-behavior: smooth; } }
.later { color: green; }
:-moz-focusring { outline: none; }
`;

const HTML = `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head>
<body><div class="card"><a href="#">x</a></div>
<script>document.body.insertAdjacentHTML('beforeend', '<p class="later">added by a script</p>');</script></body></html>`;

test('used: matches an element in some captured view, under that view\'s media, as the capture loads the page', async () => {
  await withTempDir('avb-s2-usage-', async (dir) => {
    fs.writeFileSync(path.join(dir, 'styles.css'), CSS);
    fs.writeFileSync(path.join(dir, 'index.html'), HTML);
    const rules = parseRules(CSS);
    const { used, byView } = await usedRules(browser, dir, rules, { pages: ['index.html'] });
    const selectorsOf = (ids) => ids.map((id) => `${rules[id].selector}${rules[id].media ? ` @ ${rules[id].media}` : ''}`);
    assert.deepEqual(selectorsOf([...used].sort((a, b) => a - b)), [
      'body', '.card', '.card::before', '.card @ (min-width: 992px)', '.card @ (max-width: 575.98px)', '.later',
    ]);
    assert.deepEqual(selectorsOf(byView['index.html@desktop']), ['body', '.card', '.card::before', '.card @ (min-width: 992px)', '.later']);
    assert.deepEqual(selectorsOf(byView['index.html@mobile']), ['body', '.card', '.card::before', '.card @ (max-width: 575.98px)', '.later']);
  });
});

test('on a drawn site, the used rules are a small share of a compiled Bootstrap stylesheet', async () => {
  const site = path.join(HERE, 'sites', 'agency', 'site');
  const rules = parseRules(fs.readFileSync(path.join(site, 'css', 'styles.css'), 'utf8'));
  const { used } = await usedRules(browser, site, rules, { pages: ['index.html'] });
  assert.ok(used.size > 50, `${used.size} used`);
  assert.ok(used.size < rules.length / 3, `${used.size} of ${rules.length} used`);
  const navbar = rules.find((r) => r.selector === '#mainNav' && r.media === null);
  assert.ok(navbar && used.has(navbar.id), 'the navbar rule is used');
});
