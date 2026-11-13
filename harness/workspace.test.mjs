import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  REPO_ROOT, WORK_ROOT, copyApp, applyPatch, makePatch, makeWorkspace, removeWorkspace,
  hashTree, diffTrees,
} from './workspace.mjs';

function tmpApp(files) {
  const dir = fs.mkdtempSync(path.join(fs.mkdirSync(WORK_ROOT, { recursive: true }) ?? WORK_ROOT, 'wt-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

test('the work root is inside the repo, so copies resolve the repo\'s node_modules', () => {
  assert.equal(path.dirname(WORK_ROOT), REPO_ROOT);
});

test('copyApp copies the tree and leaves node_modules and test output behind', (t) => {
  const src = tmpApp({
    'site/index.html': '<h1>hi</h1>',
    'site/css/a.css': 'a{}',
    'node_modules/x/index.js': 'x',
    'test-results/r.txt': 'r',
    'package.json': '{}',
  });
  const dest = path.join(WORK_ROOT, `wt-copy-${process.pid}`);
  t.after(() => { removeWorkspace(src); removeWorkspace(dest); });
  copyApp(src, dest);
  assert.equal(read(dest, 'site/index.html'), '<h1>hi</h1>');
  assert.equal(read(dest, 'site/css/a.css'), 'a{}');
  assert.ok(fs.existsSync(path.join(dest, 'package.json')));
  assert.ok(!fs.existsSync(path.join(dest, 'node_modules')));
  assert.ok(!fs.existsSync(path.join(dest, 'test-results')));
});

test('makePatch and applyPatch round-trip text edits, additions and deletions', (t) => {
  const base = tmpApp({ 'site/a.css': 'a { color: red; }\n', 'site/gone.txt': 'bye\n' });
  const target = tmpApp({ 'site/a.css': 'a { color: red; }\n', 'site/gone.txt': 'bye\n' });
  t.after(() => { removeWorkspace(base); removeWorkspace(target); });
  const patch = makePatch(base, (dir) => {
    fs.writeFileSync(path.join(dir, 'site/a.css'), 'a { color: blue; }\n');
    fs.rmSync(path.join(dir, 'site/gone.txt'));
    fs.writeFileSync(path.join(dir, 'site/new.html'), '<p>new</p>\n');
  });
  assert.match(patch, /^diff --git a\/site\/a\.css b\/site\/a\.css$/m);
  const file = path.join(target, 'p.patch');
  fs.writeFileSync(file, patch);
  applyPatch(target, file);
  assert.equal(read(target, 'site/a.css'), 'a { color: blue; }\n');
  assert.ok(!fs.existsSync(path.join(target, 'site/gone.txt')));
  assert.equal(read(target, 'site/new.html'), '<p>new</p>\n');
});

test('binary files round-trip through a patch', (t) => {
  const bytes = Buffer.from([0, 1, 2, 255, 254, 0, 10, 13, 7]);
  const next = Buffer.from([9, 9, 0, 255, 0, 0, 1]);
  const base = tmpApp({ 'site/f.bin': bytes });
  const target = tmpApp({ 'site/f.bin': bytes });
  t.after(() => { removeWorkspace(base); removeWorkspace(target); });
  const patch = makePatch(base, (dir) => fs.writeFileSync(path.join(dir, 'site/f.bin'), next));
  const file = path.join(target, 'p.patch');
  fs.writeFileSync(file, patch);
  applyPatch(target, file);
  assert.deepEqual(fs.readFileSync(path.join(target, 'site/f.bin')), next);
});

test('an empty patch is a no-op', (t) => {
  const dir = tmpApp({ 'site/a.css': 'a{}\n' });
  t.after(() => removeWorkspace(dir));
  const file = path.join(dir, 'empty.patch');
  fs.writeFileSync(file, '');
  applyPatch(dir, file);
  assert.equal(read(dir, 'site/a.css'), 'a{}\n');
  assert.equal(makePatch(dir, () => {}), '');
});

test('a patch that does not apply throws, and names the patch', (t) => {
  const dir = tmpApp({ 'site/a.css': 'a { color: green; }\n' });
  t.after(() => removeWorkspace(dir));
  const file = path.join(dir, 'bad.patch');
  fs.writeFileSync(file, [
    'diff --git a/site/a.css b/site/a.css',
    '--- a/site/a.css',
    '+++ b/site/a.css',
    '@@ -1 +1 @@',
    '-a { color: red; }',
    '+a { color: blue; }',
    '',
  ].join('\n'));
  assert.throws(() => applyPatch(dir, file), /bad\.patch/);
  assert.equal(read(dir, 'site/a.css'), 'a { color: green; }\n');
});

test('a patch is applied to the copy, never to the enclosing git repository', (t) => {
  // .work/ is inside this repo: git must not resolve patch paths against the repo root.
  const dir = tmpApp({ 'package.json': '{"name":"copy"}\n' });
  t.after(() => removeWorkspace(dir));
  const patch = makePatch(dir, (d) => fs.writeFileSync(path.join(d, 'package.json'), '{"name":"patched"}\n'));
  const file = path.join(dir, 'p.patch');
  fs.writeFileSync(file, patch);
  const before = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
  applyPatch(dir, file);
  assert.equal(read(dir, 'package.json'), '{"name":"patched"}\n');
  assert.equal(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'), before);
});

test('makeWorkspace copies the app and applies patches in order', (t) => {
  const app = tmpApp({ 'site/a.css': 'a { color: red; }\n' });
  const p1 = path.join(app, '..', `p1-${process.pid}.patch`);
  const p2 = path.join(app, '..', `p2-${process.pid}.patch`);
  fs.writeFileSync(p1, makePatch(app, (d) => fs.writeFileSync(path.join(d, 'site/a.css'), 'a { color: blue; }\n')));
  const mid = tmpApp({ 'site/a.css': 'a { color: blue; }\n' });
  fs.writeFileSync(p2, makePatch(mid, (d) => fs.writeFileSync(path.join(d, 'site/a.css'), 'a { color: teal; }\n')));
  const ws = makeWorkspace({ appDir: app, patches: [p1, p2], label: 'unit' });
  t.after(() => { for (const d of [app, mid, ws]) removeWorkspace(d); fs.rmSync(p1); fs.rmSync(p2); });
  assert.equal(read(ws, 'site/a.css'), 'a { color: teal; }\n');
  assert.equal(read(app, 'site/a.css'), 'a { color: red; }\n');
  assert.ok(ws.startsWith(WORK_ROOT + path.sep));
});

test('a workspace is not a git repository of its own, and has no history', (t) => {
  const app = tmpApp({ 'site/a.css': 'a{}\n' });
  const ws = makeWorkspace({ appDir: app, patches: [], label: 'unit' });
  t.after(() => { removeWorkspace(app); removeWorkspace(ws); });
  assert.ok(!fs.existsSync(path.join(ws, '.git')));
});

test('hashTree changes with content and with file names, and only then', (t) => {
  const a = tmpApp({ 'site/a.css': 'a{}\n', 'site/img/x.bin': Buffer.from([1, 2]) });
  const b = tmpApp({ 'site/img/x.bin': Buffer.from([1, 2]), 'site/a.css': 'a{}\n' });
  t.after(() => { removeWorkspace(a); removeWorkspace(b); });
  assert.equal(hashTree(path.join(a, 'site')), hashTree(path.join(b, 'site')));
  fs.writeFileSync(path.join(b, 'site/a.css'), 'a{ }\n');
  assert.notEqual(hashTree(path.join(a, 'site')), hashTree(path.join(b, 'site')));
  fs.writeFileSync(path.join(b, 'site/a.css'), 'a{}\n');
  fs.renameSync(path.join(b, 'site/a.css'), path.join(b, 'site/b.css'));
  assert.notEqual(hashTree(path.join(a, 'site')), hashTree(path.join(b, 'site')));
});

test('diffTrees lists changed, added and removed files', (t) => {
  const a = tmpApp({ 'site/a.css': 'a{}\n', 'site/b.css': 'b{}\n', 'site/c.css': 'c{}\n' });
  const b = tmpApp({ 'site/a.css': 'a{}\n', 'site/b.css': 'b{ }\n', 'site/d.css': 'd{}\n' });
  t.after(() => { removeWorkspace(a); removeWorkspace(b); });
  assert.deepEqual(diffTrees(path.join(a, 'site'), path.join(b, 'site')), [
    { path: 'b.css', change: 'changed' },
    { path: 'c.css', change: 'removed' },
    { path: 'd.css', change: 'added' },
  ]);
  assert.deepEqual(diffTrees(path.join(a, 'site'), path.join(a, 'site')), []);
});

test('removeWorkspace refuses to delete anything outside the work root', () => {
  assert.throws(() => removeWorkspace(REPO_ROOT), /outside/);
  assert.throws(() => removeWorkspace(path.join(WORK_ROOT, '..', 'harness')), /outside/);
  assert.throws(() => removeWorkspace(WORK_ROOT), /outside/);
});

test('git is available', () => {
  assert.match(execFileSync('git', ['--version'], { encoding: 'utf8' }), /git version/);
});
