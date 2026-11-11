import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyEdits, buildPatches, checkInSync, authoredTasks } from './author.mjs';
import { WORK_ROOT, REPO_ROOT, removeWorkspace, makeWorkspace, hashTree } from '../harness/workspace.mjs';

function tree(files) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(WORK_ROOT, 'author-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

test('an edit replaces the one place it names', (t) => {
  const dir = tree({ 'site/a.css': 'a { color: red; }\nb { color: red; }\n' });
  t.after(() => removeWorkspace(dir));
  applyEdits(dir, [{ file: 'site/a.css', find: 'a { color: red; }', replace: 'a { color: blue; }' }]);
  assert.equal(read(dir, 'site/a.css'), 'a { color: blue; }\nb { color: red; }\n');
});

test('an edit whose text is not there, or is there twice, is refused', (t) => {
  const dir = tree({ 'site/a.css': 'a { color: red; }\nb { color: red; }\n' });
  t.after(() => removeWorkspace(dir));
  assert.throws(() => applyEdits(dir, [{ file: 'site/a.css', find: 'c {', replace: 'd {' }]), /not found/);
  assert.throws(() => applyEdits(dir, [{ file: 'site/a.css', find: 'color: red', replace: 'color: blue' }]), /2 times/);
  assert.throws(() => applyEdits(dir, [{ file: 'site/nope.css', find: 'a', replace: 'b' }]), /nope\.css/);
});

test('one edit can name several files', (t) => {
  const dir = tree({ 'site/a.html': '<nav>x</nav>', 'site/b.html': '<nav>x</nav>' });
  t.after(() => removeWorkspace(dir));
  applyEdits(dir, [{ files: ['site/a.html', 'site/b.html'], find: '<nav>x</nav>', replace: '<nav>y</nav>' }]);
  assert.equal(read(dir, 'site/a.html'), '<nav>y</nav>');
  assert.equal(read(dir, 'site/b.html'), '<nav>y</nav>');
});

test('append adds to the end of a file; copyFrom replaces a file with another one', (t) => {
  const dir = tree({ 'site/a.css': 'a{}\n', 'site/f.bin': Buffer.from([1, 2, 3]) });
  const src = tree({ 'assets/new.bin': Buffer.from([9, 8]) });
  t.after(() => { removeWorkspace(dir); removeWorkspace(src); });
  applyEdits(dir, [
    { file: 'site/a.css', append: 'b{}\n' },
    { file: 'site/f.bin', copyFrom: 'assets/new.bin' },
  ], src);
  assert.equal(read(dir, 'site/a.css'), 'a{}\nb{}\n');
  assert.deepEqual([...fs.readFileSync(path.join(dir, 'site/f.bin'))], [9, 8]);
});

test('an edit that is not one of the known kinds is refused', (t) => {
  const dir = tree({ 'site/a.css': 'a{}\n' });
  t.after(() => removeWorkspace(dir));
  assert.throws(() => applyEdits(dir, [{ file: 'site/a.css', remove: true }]), /unknown edit/);
});

test('buildPatches: "revert" as the reference is the seed undone, and solutions apply on top of the seed', (t) => {
  const app = tree({ 'site/a.css': 'a { color: red; }\nb { margin: 0; }\n' });
  t.after(() => removeWorkspace(app));
  const patches = buildPatches(app, {
    seed: [{ file: 'site/a.css', find: 'color: red', replace: 'color: white' }],
    reference: 'revert',
    wrong: [{ file: 'site/a.css', find: 'b { margin: 0; }', replace: 'b { margin: 0; color: red; }' }],
    accepted: { override: [{ file: 'site/a.css', append: 'a { color: red; }\n' }] },
  });
  assert.match(patches.seed, /\+a \{ color: white; \}/);
  assert.match(patches.reference, /\+a \{ color: red; \}/);
  assert.match(patches.wrong, /\+b \{ margin: 0; color: red; \}/);
  assert.deepEqual(Object.keys(patches.accepted), ['override']);

  const write = (name, body) => { const f = path.join(app, '..', `${path.basename(app)}-${name}.patch`); fs.writeFileSync(f, body); return f; };
  const seedFile = write('seed', patches.seed);
  const refFile = write('ref', patches.reference);
  const ws = makeWorkspace({ appDir: app, patches: [seedFile, refFile], label: 'author' });
  t.after(() => { removeWorkspace(ws); fs.rmSync(seedFile); fs.rmSync(refFile); });
  assert.equal(hashTree(path.join(ws, 'site')), hashTree(path.join(app, 'site')));
});

test('buildPatches: a change task may have no seed; a decoy has an empty reference', (t) => {
  const app = tree({ 'site/a.css': 'a { color: red; }\n' });
  t.after(() => removeWorkspace(app));
  const change = buildPatches(app, {
    seed: [],
    reference: [{ file: 'site/a.css', find: 'red', replace: 'green' }],
    wrong: [{ file: 'site/a.css', find: 'red', replace: 'lime' }],
  });
  assert.equal(change.seed, '');
  assert.match(change.reference, /green/);
  const decoy = buildPatches(app, {
    seed: [{ file: 'site/a.css', append: '\n' }],
    reference: [],
    wrong: [{ file: 'site/a.css', find: 'red', replace: 'lime' }],
  });
  assert.equal(decoy.reference, '');
});

test('every committed patch is what its edits file produces', async () => {
  const tasks = authoredTasks(REPO_ROOT);
  const stale = [];
  for (const id of tasks) stale.push(...(await checkInSync(REPO_ROOT, id)));
  assert.deepEqual(stale, []);
});
