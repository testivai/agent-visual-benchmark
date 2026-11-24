import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, perturb, classOf, candidatesOf, mutationOf, applyMutations } from './mutate.mjs';
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

const decl = (c) => `${c.rule.selector} ${c.d.property}`;

test('the candidates of a class: its declarations that the rule can change, in the rules the page uses', () => {
  const rules = parseRules(CSS);
  const used = new Set([0, 1, 2]);
  assert.deepEqual(candidatesOf(rules, used, 'colour').map(decl), ['.a color'], 'not the unused rule');
  assert.deepEqual(candidatesOf(rules, used, 'margin').map(decl), [], '0 auto has nothing to scale');
  assert.deepEqual(candidatesOf(rules, used, 'font-weight').map(decl), ['.b font-weight']);
  assert.deepEqual(candidatesOf(rules, new Set([3]), 'colour').map(decl), ['.unused color']);
  assert.deepEqual(candidatesOf(rules, new Set(), 'colour'), [], 'nothing used, nothing to draw');
});

test('declarations already mutated by another task are not candidates; nor are rules this task has already changed', () => {
  const rules = parseRules(CSS);
  const used = new Set([0, 1, 2]);
  const padding = candidatesOf(rules, used, 'padding')[0].d;
  assert.deepEqual(candidatesOf(rules, used, 'padding', { skip: new Set([padding.valueStart]) }), []);
  assert.deepEqual(candidatesOf(rules, used, 'padding', { takenRules: new Set([0]) }), []);
  assert.deepEqual(candidatesOf(rules, used, 'display-and-flex', { takenRules: new Set([0]) }).map(decl), ['.c display']);
});

test('a mutation: the declaration where it is in the file, and a new value by its class\'s rule', () => {
  const rules = parseRules(CSS);
  const used = new Set([0, 1, 2]);
  const ms = ['colour', 'font-weight', 'display-and-flex'].map((cls) => {
    const [{ rule, d }] = candidatesOf(rules, used, cls);
    return mutationOf(rule, d, cls, mulberry32(4));
  });
  assert.deepEqual(ms[0], {
    ruleId: 0, selector: '.a', media: null, class: 'colour', property: 'color', from: '#0d6efd', to: '#fd9c0d',
    valueStart: CSS.indexOf('#0d6efd'), valueEnd: CSS.indexOf('#0d6efd') + 7,
  });
  assert.equal(ms[1].to, '400');
  assert.ok(['block', 'inline-block', 'none'].includes(ms[2].to));
  const out = applyMutations(CSS, ms);
  for (const m of ms) assert.ok(out.includes(m.to), m.to);
  assert.equal(out.split('\n').length, CSS.split('\n').length, 'no line added or removed');
});

test('a custom property holding a literal colour is a colour declaration (Bootstrap 5 keeps its colours there)', () => {
  assert.equal(classOf('--bs-btn-bg', '#0d6efd'), 'colour');
  assert.equal(perturb('--bs-btn-bg', '#0d6efd', fixed(0.5)), '#fd9c0d');
  assert.equal(classOf('--bs-dark-rgb', '33, 37, 41'), 'colour', 'the r, g, b triple behind rgba(var(--bs-dark-rgb), ...)');
  assert.equal(perturb('--bs-dark-rgb', '33, 37, 41', fixed(0.5)), '214, 218, 222');
  assert.equal(perturb('--bs-box-shadow', '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', fixed(0.5)), '0 0.5rem 1rem rgba(255, 255, 255, 0.15)');
  for (const [property, value] of [['--bs-gutter-x', '1.5rem'], ['--bs-font-sans-serif', 'system-ui, -apple-system, "Segoe UI"'],
    ['--bs-btn-color', 'var(--bs-white)'], ['--bs-bg-opacity', '1'], ['--bs-rgb', '1, 2'], ['--bs-z', '33, 37, 41']]) {
    assert.equal(classOf(property, value), null, `${property}: ${value}`);
    assert.equal(perturb(property, value, fixed(0.5)), null, `${property}: ${value}`);
  }
  assert.equal(classOf('padding', '1rem'), 'padding');
  assert.equal(classOf('transform', 'none'), null);
});

test('colours held in custom properties are candidates of the colour class', () => {
  const css = '.btn-primary { --bs-btn-bg: #0d6efd; --bs-btn-padding-x: 0.75rem; }\n.navbar { --bs-dark-rgb: 33, 37, 41; }';
  const rules = parseRules(css);
  assert.deepEqual(candidatesOf(rules, new Set([0, 1]), 'colour').map(decl), ['.btn-primary --bs-btn-bg', '.navbar --bs-dark-rgb']);
  assert.deepEqual(candidatesOf(rules, new Set([0, 1]), 'padding'), [], 'a custom property is never a length declaration');
});
