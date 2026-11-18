import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, perturb, drawMutations, applyMutations } from './mutate.mjs';
import { parseRules } from './css.mjs';
import { mulberry32 } from '../runner/rng.mjs';

// A random that returns the given values in turn (then repeats the last).
const fixed = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

test('the property classes are the published list', () => {
  assert.deepEqual(Object.keys(CLASSES), [
    'colour', 'background', 'font-size', 'font-weight', 'letter-spacing', 'line-height', 'margin', 'padding',
    'width', 'display-and-flex', 'position-and-z-index', 'border', 'opacity', 'overflow', 'text-transform',
  ]);
});

test('lengths: the first non-zero number is scaled by 0.5 or 1.5; px moves by at least 1; !important stays', () => {
  assert.equal(perturb('padding', '0.5rem 1rem', fixed(0.9)), '0.75rem 1rem');
  assert.equal(perturb('margin-bottom', '1.5rem', fixed(0.1)), '0.75rem');
  assert.equal(perturb('font-size', '2.25rem !important', fixed(0.9)), '3.375rem !important');
  assert.equal(perturb('border', '1px solid #dee2e6', fixed(0.9)), '2px solid #dee2e6');
  assert.equal(perturb('border-width', '1px', fixed(0.1)), '0px');
  assert.equal(perturb('margin', '0 auto', fixed(0.9)), null, 'nothing to scale');
  assert.equal(perturb('width', 'calc(100% - 2rem)', fixed(0.9)), null);
  assert.equal(perturb('padding', 'var(--bs-gutter-x)', fixed(0.9)), null);
  assert.equal(perturb('line-height', '1.2', fixed(0.9)), '1.8');
});

test('colours: hue turned half-way round; greys, black and white have their lightness inverted', () => {
  assert.equal(perturb('color', '#0d6efd', fixed(0.5)), '#fd9c0d');
  assert.equal(perturb('color', '#fff', fixed(0.5)), '#000000');
  assert.equal(perturb('background-color', 'rgba(0, 0, 0, 0.5)', fixed(0.5)), 'rgba(255, 255, 255, 0.5)');
  assert.equal(perturb('background', '#212529 url("x.png") no-repeat', fixed(0.5)), '#d6dade url("x.png") no-repeat');
  assert.equal(perturb('color', 'var(--bs-body-color)', fixed(0.5)), null);
  assert.equal(perturb('color', 'inherit', fixed(0.5)), null);
});

test('keywords: swapped for another value of the same property, never the same one', () => {
  assert.equal(perturb('font-weight', '700', fixed(0.5)), '400');
  assert.equal(perturb('font-weight', 'bold', fixed(0.5)), '400');
  assert.equal(perturb('font-weight', '300', fixed(0.5)), '700');
  assert.equal(perturb('text-transform', 'uppercase', fixed(0.5)), 'none');
  assert.equal(perturb('text-transform', 'none', fixed(0.5)), 'uppercase');
  assert.equal(perturb('overflow', 'hidden', fixed(0.5)), 'visible');
  assert.equal(perturb('opacity', '1', fixed(0.5)), '0.3');
  assert.equal(perturb('opacity', '0.25', fixed(0.5)), '1');
  assert.equal(perturb('z-index', '1030', fixed(0.5)), '-1');
  assert.equal(perturb('z-index', 'auto', fixed(0.5)), null);
  for (const [property, value] of [['display', 'flex'], ['position', 'relative'], ['justify-content', 'center'], ['flex-direction', 'row']]) {
    const out = perturb(property, value, mulberry32(3));
    assert.ok(out && out !== value, `${property}: ${value} -> ${out}`);
  }
});

const CSS = `.a { color: #0d6efd; padding: 1rem; }
.b { margin: 0 auto; font-weight: 700; }
.c { display: flex; }
.unused { color: #000; }`;

test('draw: a class at random, then a declaration of it at random among the rules the page uses', () => {
  const rules = parseRules(CSS);
  const used = new Set([0, 1, 2]);
  for (let seed = 1; seed <= 40; seed++) {
    const [m] = drawMutations(rules, used, mulberry32(seed), 1);
    assert.ok(m, `seed ${seed}`);
    assert.notEqual(m.selector, '.unused');
    assert.notEqual(m.to, m.from);
    assert.equal(CSS.slice(m.valueStart, m.valueEnd), m.from);
  }
});

test('several mutations land on different rules; applying them edits the source in place', () => {
  const rules = parseRules(CSS);
  const ms = drawMutations(rules, new Set([0, 1, 2]), mulberry32(11), 3);
  assert.equal(new Set(ms.map((m) => m.ruleId)).size, ms.length);
  const out = applyMutations(CSS, ms);
  for (const m of ms) assert.ok(out.includes(m.to), m.to);
  assert.equal(out.split('\n').length, CSS.split('\n').length, 'no line added or removed');
  assert.equal(drawMutations(rules, new Set([3]), mulberry32(1), 1).length, 1, 'a rule outside the used set is never drawn... unless it is the only one used');
  assert.deepEqual(drawMutations(rules, new Set(), mulberry32(1), 1), [], 'nothing used, nothing drawn');
});
