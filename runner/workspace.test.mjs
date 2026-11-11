// The guard every workspace passes before an agent sees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkWorkspace } from './workspace.mjs';
import { WORK_ROOT, removeWorkspace } from '../harness/workspace.mjs';

const BENCH = '/home/me/agent-visual-benchmark';

function tree(files) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(WORK_ROOT, 'wscheck-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

const BASE = {
  'site/index.html': '<h1>Acme</h1>',
  'tests/functional.spec.ts': 'test()',
  'package.json': '{"name":"acme-storefront"}',
  'CLAUDE.md': '# Acme Storefront',
  'node_modules/@playwright/test/index.js': 'pw',
};
const B_FILES = { 'tests/visual.spec.ts': 'v', 'tests/visual.spec.ts-snapshots/home-desktop-linux.png': 'png' };
const C_FILES = { 'tests/visual.spec.ts': 'v', '.testivai/baselines/home__desktop/dom.html': '<h1>', 'node_modules/@testivai/mcp/dist/server.js': 's' };

const problems = (files, arm) => {
  const ws = tree(files);
  try {
    return checkWorkspace(ws, { arm, benchRoot: BENCH, requireGit: false });
  } finally {
    removeWorkspace(ws);
  }
};

test('a clean workspace for each arm has no problems', () => {
  assert.deepEqual(problems(BASE, 'A'), []);
  assert.deepEqual(problems({ ...BASE, ...B_FILES }, 'B'), []);
  assert.deepEqual(problems({ ...BASE, ...C_FILES }, 'C'), []);
});

test('nothing from the benchmark may be in a workspace', () => {
  for (const rel of ['oracle/t01/score.spec.ts', 'tasks/t01/task.json', 'TASKS.md', 'PREREGISTRATION.md', 'harness/validate.mjs',
    'runner/run.mjs', 'arms/C/files/package.json', 'results/runs.jsonl', 'bench.config.json', 'runner.config.json', 'BUDGET.md',
    '.claude/settings.json', 'site/oracle/x.txt', 'site/fix.patch']) {
    assert.ok(problems({ ...BASE, [rel]: 'x' }, 'A').length > 0, rel);
  }
});

test('no file may mention the benchmark, its path or its answer files', () => {
  for (const body of [`see ${BENCH}/oracle`, 'agent-visual-benchmark', 'apply reference.patch', 'the oracle says']) {
    assert.ok(problems({ ...BASE, 'site/notes.txt': body }, 'A').length > 0, body);
  }
  // node_modules is not scanned: packages are third-party and pinned
  assert.deepEqual(problems({ ...BASE, 'node_modules/x/README.md': 'oracle' }, 'A'), []);
});

test('another arm\'s files may not be in a workspace', () => {
  assert.match(problems({ ...BASE, ...B_FILES }, 'A').join('\n'), /visual/);
  assert.match(problems({ ...BASE, ...C_FILES }, 'A').join('\n'), /\.testivai|@testivai/);
  assert.match(problems({ ...BASE, ...B_FILES, '.testivai/config.json': '{}' }, 'B').join('\n'), /\.testivai/);
  assert.match(problems({ ...BASE, ...B_FILES, 'node_modules/@testivai/witness/x.js': 'x' }, 'B').join('\n'), /@testivai/);
  assert.match(problems({ ...BASE, ...C_FILES, 'tests/visual.spec.ts-snapshots/a.png': 'png' }, 'C').join('\n'), /snapshots/);
});

test('an arm\'s own files must be there', () => {
  assert.match(problems(BASE, 'B').join('\n'), /visual\.spec\.ts/);
  assert.match(problems({ ...BASE, 'tests/visual.spec.ts': 'v' }, 'C').join('\n'), /baselines/);
});
