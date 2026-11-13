import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffSnapshots, buildScope, checkRestored, checkCollateral, familyOf, describeEntry,
} from './compare.mjs';

const el = (over = {}) => ({ x: 10, y: 20, w: 100, h: 40, color: 'rgb(0, 0, 0)', text: 'Hello', vis: 1, top: 5, ...over });
const snap = (views) => ({ views });
const view = (elements, doc = { scrollW: 1280, scrollH: 900, fonts: 'Acme Sans:loaded' }) => ({ doc, elements });

const base = () => snap({
  'home@desktop': view({ '.btn[0]': el(), '.btn[1]': el({ x: 200 }), 'h1[0]': el({ y: 100, text: 'Title' }) }),
  'pricing@desktop': view({ '.btn[0]': el(), '.plan[0]': el({ w: 300 }) }),
});

const edit = (s, fn) => { const copy = structuredClone(s); fn(copy.views); return copy; };

test('identical snapshots have no differences', () => {
  assert.deepEqual(diffSnapshots(base(), base()), []);
});

test('a changed field is reported as view|key|field', () => {
  const b = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(255, 0, 0)'; });
  assert.deepEqual(diffSnapshots(base(), b), ['home@desktop|.btn[1]|color']);
});

test('numbers within half a pixel are equal; beyond it they differ', () => {
  const near = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].y = 100.5; });
  const far = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].y = 100.51; });
  assert.deepEqual(diffSnapshots(base(), near), []);
  assert.deepEqual(diffSnapshots(base(), far), ['home@desktop|h1[0]|y']);
});

test('the visible fraction has its own, small tolerance', () => {
  const near = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].vis = 0.985; });
  const far = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].vis = 0.9; });
  assert.deepEqual(diffSnapshots(base(), near), []);
  assert.deepEqual(diffSnapshots(base(), far), ['home@desktop|h1[0]|vis']);
});

test('null and a number differ (an element that lost its box)', () => {
  const b = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].top = null; });
  assert.deepEqual(diffSnapshots(base(), b), ['home@desktop|h1[0]|top']);
});

test('a missing element and an extra element are reported', () => {
  const b = edit(base(), (v) => {
    delete v['home@desktop'].elements['.btn[1]'];
    v['pricing@desktop'].elements['.plan[1]'] = el();
  });
  assert.deepEqual(diffSnapshots(base(), b), ['home@desktop|.btn[1]|@exists', 'pricing@desktop|.plan[1]|@extra']);
});

test('document-level fields are compared under @doc', () => {
  const b = edit(base(), (v) => { v['home@desktop'].doc.scrollW = 1400; v['home@desktop'].doc.fonts = 'Acme Sans:error'; });
  assert.deepEqual(diffSnapshots(base(), b), ['home@desktop|@doc|fonts', 'home@desktop|@doc|scrollW']);
});

test('a view that could not be reached is reported as one difference', () => {
  const b = edit(base(), (v) => { v['pricing@desktop'] = { error: 'could not open the order dialog' }; });
  assert.deepEqual(diffSnapshots(base(), b), ['pricing@desktop|@view|error']);
  assert.deepEqual(diffSnapshots(b, b), []);
});

test('a view missing from one snapshot is reported', () => {
  const b = edit(base(), (v) => { delete v['pricing@desktop']; });
  assert.deepEqual(diffSnapshots(base(), b), ['pricing@desktop|@view|@exists']);
});

test('familyOf strips the index', () => {
  assert.equal(familyOf('.btn[12]'), '.btn');
  assert.equal(familyOf('h1[0]'), 'h1');
  assert.equal(familyOf('@doc'), '@doc');
});

test('fix task: every field the seed changed must be restored, everything else is collateral', () => {
  const seeded = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(255, 255, 255)'; });
  const scope = buildScope({ type: 'fix', clean: base(), seeded, solutions: [base()] });
  assert.deepEqual([...scope.mustRestore], ['home@desktop|.btn[1]|color']);

  // doing nothing: not restored, nothing else touched
  assert.equal(checkRestored(base(), seeded, scope).length, 1);
  assert.deepEqual(checkCollateral(base(), seeded, scope), []);

  // the correct fix
  assert.deepEqual(checkRestored(base(), base(), scope), []);
  assert.deepEqual(checkCollateral(base(), base(), scope), []);

  // a different colour is not a restoration
  const guess = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(10, 10, 10)'; });
  assert.equal(checkRestored(base(), guess, scope).length, 1);

  // fixed, but another page was changed on the way
  const collateral = edit(base(), (v) => { v['pricing@desktop'].elements['.btn[0]'].color = 'rgb(9, 9, 9)'; });
  assert.deepEqual(checkRestored(base(), collateral, scope), []);
  assert.deepEqual(checkCollateral(base(), collateral, scope).map((c) => c.entry), ['pricing@desktop|.btn[0]|color']);

  // fixed, but another field of the same element was changed: still collateral
  const sameEl = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].w = 140; });
  assert.deepEqual(checkCollateral(base(), sameEl, scope).map((c) => c.entry), ['home@desktop|.btn[1]|w']);
});

test('fix task: an element the seed removed must come back, one it added must go', () => {
  const seeded = edit(base(), (v) => {
    delete v['home@desktop'].elements['h1[0]'];
    v['home@desktop'].elements['.btn[2]'] = el({ x: 400 });
  });
  const scope = buildScope({ type: 'fix', clean: base(), seeded, solutions: [base()] });
  assert.deepEqual([...scope.mustRestore].sort(), ['home@desktop|.btn[2]|@extra', 'home@desktop|h1[0]|@exists']);
  assert.equal(checkRestored(base(), seeded, scope).length, 2);
  assert.deepEqual(checkRestored(base(), base(), scope), []);
  // the element is back but in the wrong place: the seed removed all of it, so all of it is checked
  const moved = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].y = 300; });
  assert.equal(checkRestored(base(), moved, scope).length, 1);
});

test('fix task: a reference that does not restore the clean app is refused', () => {
  const seeded = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(255, 255, 255)'; });
  const notClean = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(1, 1, 1)'; });
  assert.throws(
    () => buildScope({ type: 'fix', clean: base(), seeded, solutions: [notClean] }),
    /reference.*does not restore.*home@desktop\|\.btn\[1\]\|color/s,
  );
});

test('fix task: what an accepted alternative leaves different is tolerated, not required', () => {
  const seeded = edit(base(), (v) => {
    v['home@desktop'].elements['.btn[1]'].color = 'rgb(255, 255, 255)';
    v['home@desktop'].elements['.btn[1]'].w = 80;
  });
  // the alternative restores the colour and leaves the width 1px off
  const alt = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].w = 101; });
  const scope = buildScope({ type: 'fix', clean: base(), seeded, solutions: [base(), alt] });
  assert.deepEqual([...scope.mustRestore], ['home@desktop|.btn[1]|color']);
  assert.deepEqual(checkRestored(base(), alt, scope), []);
  assert.deepEqual(checkCollateral(base(), alt, scope), []);
});

test('change task: what the reference restyles is free as a whole element; what it only moves is free in position only', () => {
  const reference = edit(base(), (v) => {
    v['pricing@desktop'].elements['.btn[0]'].color = 'rgb(0, 128, 0)'; // restyled
    v['pricing@desktop'].elements['.plan[0]'].y = 60; // only moved
  });
  const scope = buildScope({ type: 'change', clean: base(), seeded: base(), solutions: [reference] });
  assert.equal(scope.mustRestore.size, 0);

  assert.deepEqual(checkCollateral(base(), reference, scope), []);

  // another way to make the change that also resizes the restyled button: allowed
  const alt = edit(reference, (v) => { v['pricing@desktop'].elements['.btn[0]'].w = 120; });
  assert.deepEqual(checkCollateral(base(), alt, scope), []);

  // restyling the element that was only supposed to move: collateral
  const restyledMoved = edit(reference, (v) => { v['pricing@desktop'].elements['.plan[0]'].color = 'rgb(1, 2, 3)'; });
  assert.deepEqual(checkCollateral(base(), restyledMoved, scope).map((c) => c.entry), ['pricing@desktop|.plan[0]|color']);

  // the careless edit: the same button on another page changed too
  const careless = edit(reference, (v) => { v['home@desktop'].elements['.btn[0]'].color = 'rgb(0, 128, 0)'; });
  assert.deepEqual(checkCollateral(base(), careless, scope).map((c) => c.entry), ['home@desktop|.btn[0]|color']);
});

test('decoy: what the seed itself changed is free; anything else is collateral', () => {
  const seeded = edit(base(), (v) => { v['home@desktop'].elements['h1[0]'].w = 101; });
  const scope = buildScope({ type: 'decoy', clean: base(), seeded, solutions: [seeded] });
  assert.equal(scope.mustRestore.size, 0);
  assert.deepEqual(checkCollateral(base(), seeded, scope), []);
  const touched = edit(seeded, (v) => { v['home@desktop'].elements['h1[0]'].color = 'rgb(9, 9, 9)'; });
  assert.deepEqual(checkCollateral(base(), touched, scope).map((c) => c.entry), ['home@desktop|h1[0]|color']);
});

test('collateral: a new element of a kind the page already has counts; a brand-new kind does not', () => {
  const scope = buildScope({ type: 'decoy', clean: base(), seeded: base(), solutions: [base()] });
  const extraBtn = edit(base(), (v) => { v['home@desktop'].elements['.btn[2]'] = el(); });
  assert.deepEqual(checkCollateral(base(), extraBtn, scope).map((c) => c.entry), ['home@desktop|.btn[2]|@extra']);
  const wrapper = edit(base(), (v) => { v['home@desktop'].elements['.table-scroll[0]'] = el(); });
  assert.deepEqual(checkCollateral(base(), wrapper, scope), []);
});

test('collateral: a removed element and an unreachable view count', () => {
  const scope = buildScope({ type: 'decoy', clean: base(), seeded: base(), solutions: [base()] });
  const removed = edit(base(), (v) => { delete v['home@desktop'].elements['h1[0]']; });
  assert.deepEqual(checkCollateral(base(), removed, scope).map((c) => c.entry), ['home@desktop|h1[0]|@exists']);
  const broken = edit(base(), (v) => { v['home@desktop'] = { error: 'the page did not load' }; });
  assert.deepEqual(checkCollateral(base(), broken, scope).map((c) => c.entry), ['home@desktop|@view|error']);
});

test('violations say what was expected and what was found', () => {
  const seeded = edit(base(), (v) => { v['home@desktop'].elements['.btn[1]'].color = 'rgb(255, 255, 255)'; });
  const scope = buildScope({ type: 'fix', clean: base(), seeded, solutions: [base()] });
  const [violation] = checkRestored(base(), seeded, scope);
  assert.equal(violation.entry, 'home@desktop|.btn[1]|color');
  assert.equal(violation.expected, 'rgb(0, 0, 0)');
  assert.equal(violation.actual, 'rgb(255, 255, 255)');
  assert.match(describeEntry(violation), /home@desktop.*\.btn\[1\].*color.*rgb\(0, 0, 0\).*rgb\(255, 255, 255\)/);
});
