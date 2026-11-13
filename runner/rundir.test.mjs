import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRunDir, removeStaleRunDirs, processAlive, defaultRunRoot } from './rundir.mjs';

const scratch = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-rundir-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
};
// a pid that was alive a moment ago and is not any more
const deadPid = () => spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout.trim();

test('the run root is outside the system temporary directory and the home directory, unless set', () => {
  const root = defaultRunRoot({});
  assert.ok(!root.startsWith(os.tmpdir() + path.sep) && root !== os.tmpdir(), root);
  assert.ok(!root.startsWith(os.homedir() + path.sep), root);
  assert.equal(defaultRunRoot({ AVB_RUN_ROOT: '/srv/runs' }), '/srv/runs');
});

test('a run directory is made under the root, private, and names its owner', (t) => {
  const root = path.join(scratch(t), 'runs');
  const dir = makeRunDir(root);
  assert.equal(path.dirname(dir), root);
  assert.match(path.basename(dir), /^avb-/);
  assert.equal(fs.readFileSync(path.join(dir, '.owner'), 'utf8').trim(), String(process.pid));
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
});

test('processAlive: this process is, a finished one is not', () => {
  assert.equal(processAlive(process.pid), true);
  assert.equal(processAlive(Number(deadPid())), false);
  assert.equal(processAlive(NaN), false);
});

test('stale run directories (owner gone, or no owner) are removed; a live owner\'s is kept', (t) => {
  const root = scratch(t);
  const mine = makeRunDir(root);
  const dead = makeRunDir(root);
  fs.writeFileSync(path.join(dead, '.owner'), `${deadPid()}\n`);
  const orphan = path.join(root, 'avb-orphan');
  fs.mkdirSync(orphan);
  const removed = removeStaleRunDirs(root);
  assert.deepEqual(removed.sort(), [dead, orphan].sort());
  assert.ok(fs.existsSync(mine));
  assert.ok(!fs.existsSync(dead) && !fs.existsSync(orphan));
});

test('making a run directory first removes the stale ones', (t) => {
  const root = scratch(t);
  const orphan = path.join(root, 'avb-left-by-a-restart');
  fs.mkdirSync(orphan);
  makeRunDir(root);
  assert.ok(!fs.existsSync(orphan));
});
