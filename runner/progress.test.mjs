import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { saveProgress, shouldSave } from './progress.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(cwd) } }).trim();

function repoWithRemote() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-progress-'));
  const remote = path.join(root, 'remote.git');
  const repo = path.join(root, 'repo');
  git(root, 'init', '-q', '--bare', remote);
  git(root, 'init', '-q', '-b', 'study', repo);
  for (const [k, v] of [['user.name', 'Test'], ['user.email', 't@example.invalid'], ['commit.gpgsign', 'false']]) git(repo, 'config', k, v);
  fs.writeFileSync(path.join(repo, 'README.md'), 'x\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'start');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-q', '-u', 'origin', 'study');
  return { root, remote, repo };
}

test('save every n finished runs, and at the end', () => {
  assert.equal(shouldSave({ finished: 6, every: 6 }), true);
  assert.equal(shouldSave({ finished: 7, every: 6 }), false);
  assert.equal(shouldSave({ finished: 3, every: 6, last: true }), true);
  assert.equal(shouldSave({ finished: 6, every: 0 }), false, 'off when every is 0');
});

test('results are committed with CI skipped and pushed; only the results directory is added', (t) => {
  const { root, remote, repo } = repoWithRemote();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'results', 'sonnet', 'pilot'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'results', 'sonnet', 'pilot', 'runs.jsonl'), '{"run_id":"pilot-001"}\n');
  fs.writeFileSync(path.join(repo, 'unrelated.txt'), 'not results\n');
  const r = saveProgress({ repoDir: repo, resultsDir: path.join(repo, 'results', 'sonnet', 'pilot'), message: 'Results: sonnet pilot, 1 of 54 runs', trailer: 'Trailer: yes' });
  assert.equal(r.saved, true);
  const subject = git(remote, 'log', '-1', '--format=%s', 'study');
  assert.equal(subject, 'Results: sonnet pilot, 1 of 54 runs [skip ci]');
  assert.match(git(remote, 'log', '-1', '--format=%b', 'study'), /Trailer: yes/);
  assert.deepEqual(git(remote, 'show', '--name-only', '--format=', 'study').split('\n'), ['results/sonnet/pilot/runs.jsonl']);
  assert.equal(git(repo, 'status', '--porcelain'), '?? unrelated.txt');
});

test('nothing new: no commit; a failed push is reported, not thrown', (t) => {
  const { root, repo } = repoWithRemote();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'results'), { recursive: true });
  assert.deepEqual(saveProgress({ repoDir: repo, resultsDir: path.join(repo, 'results'), message: 'm' }), { saved: false, reason: 'nothing new' });
  fs.writeFileSync(path.join(repo, 'results', 'a.txt'), 'a\n');
  git(repo, 'remote', 'set-url', 'origin', path.join(root, 'nowhere.git'));
  const r = saveProgress({ repoDir: repo, resultsDir: path.join(repo, 'results'), message: 'm' });
  assert.equal(r.saved, false);
  assert.match(r.reason, /push failed/);
});

test('a git error while saving (the index locked by another git command) is reported, never thrown', (t) => {
  const { root, repo } = repoWithRemote();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'results'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'results', 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(repo, '.git', 'index.lock'), '');
  const r = saveProgress({ repoDir: repo, resultsDir: path.join(repo, 'results'), message: 'm' });
  assert.equal(r.saved, false);
  assert.match(r.reason, /not saved: .*index\.lock/);
  // the next save, once the lock is gone, commits what the failed one missed
  fs.rmSync(path.join(repo, '.git', 'index.lock'));
  assert.equal(saveProgress({ repoDir: repo, resultsDir: path.join(repo, 'results'), message: 'm' }).saved, true);
});
