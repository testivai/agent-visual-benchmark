import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules } from './css.mjs';

const CSS = `/*! Bootstrap v5 | MIT { not a rule } */
:root { --bs-blue: #0d6efd; }
.btn-primary { color: #fff; background-color: #0d6efd; border-color: #0d6efd }
@media (min-width: 992px) {
  .navbar-expand-lg .navbar-nav { flex-direction: row; }
  .masthead h1 { font-size: 4.5rem; line-height: 1.2 }
}
@font-face { font-family: "X"; src: url("a.woff2") format("woff2"); }
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
.icon { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3c/svg%3e"); }
a:hover, a:focus { text-decoration: underline; }
`;

test('every style rule, with the @media it sits in, and each declaration where it is in the file', () => {
  const rules = parseRules(CSS);
  assert.deepEqual(rules.map((r) => [r.selector, r.media]), [
    [':root', null],
    ['.btn-primary', null],
    ['.navbar-expand-lg .navbar-nav', '(min-width: 992px)'],
    ['.masthead h1', '(min-width: 992px)'],
    ['.icon', null],
    ['a:hover, a:focus', null],
  ]);
  const btn = rules[1];
  assert.deepEqual(btn.declarations.map((d) => [d.property, d.value]), [['color', '#fff'], ['background-color', '#0d6efd'], ['border-color', '#0d6efd']]);
  for (const rule of rules) {
    for (const d of rule.declarations) assert.equal(CSS.slice(d.valueStart, d.valueEnd), d.value, `${rule.selector} ${d.property}`);
  }
});

test('comments, @font-face and @keyframes are not style rules; a value can hold colons, braces and semicolons in quotes', () => {
  const rules = parseRules(CSS);
  assert.ok(!rules.some((r) => /from|to|Bootstrap/.test(r.selector)));
  const icon = rules.find((r) => r.selector === '.icon');
  assert.equal(icon.declarations.length, 1);
  assert.match(icon.declarations[0].value, /^url\("data:image\/svg\+xml,.*"\)$/);
});

test('ids are stable and in file order', () => {
  const rules = parseRules(CSS);
  assert.deepEqual(rules.map((r) => r.id), [0, 1, 2, 3, 4, 5]);
  assert.ok(rules.every((r, i) => i === 0 || r.start > rules[i - 1].start));
});
