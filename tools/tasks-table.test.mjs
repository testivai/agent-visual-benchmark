import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderTasksTable, taskRows } from './tasks-table.mjs';
import { seedsHash } from '../harness/visibility.mjs';
import { REPO_ROOT } from '../harness/workspace.mjs';

const rows = await taskRows(REPO_ROOT);
const visibility = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'oracle', 'visibility.json'), 'utf8'));

test('TASKS.md is what the task files produce', async () => {
  const onDisk = fs.readFileSync(path.join(REPO_ROOT, 'TASKS.md'), 'utf8');
  assert.equal(onDisk, await renderTasksTable(REPO_ROOT), 'run: node tools/tasks-table.mjs');
});

test('every task has a one-line summary', () => {
  for (const row of rows) {
    assert.ok(row.summary && row.summary.length > 20 && !row.summary.includes('\n'), row.id);
  }
});

test('the visibility measurements were taken on the current app and seeds', () => {
  assert.equal(visibility.measuredOn, seedsHash(REPO_ROOT), 'run: npm run visibility');
});

test('each notes.md says what the measurement says about screenshots', () => {
  for (const row of rows) {
    const notes = fs.readFileSync(path.join(REPO_ROOT, 'oracle', row.id, 'notes.md'), 'utf8');
    assert.match(notes, new RegExp(`^# ${row.id}$`, 'm'), row.id);
    const v = visibility.tasks[row.id];
    const yn = (b) => (b ? 'yes' : 'no');
    if (row.type === 'fix') {
      assert.ok(notes.includes(`Full-page screenshot at 1280x800 shows it: ${yn(v.desktop)}`), `${row.id} desktop`);
      assert.ok(notes.includes(`Full-page screenshot at 390x844 shows it: ${yn(v.mobile)}`), `${row.id} phone`);
      assert.equal(notes.includes('**Flag: not visible at the default viewport.**'), !v.desktop, `${row.id} flag`);
    } else if (row.type === 'decoy') {
      assert.ok(notes.includes(`Pixel comparison at 1280x800 flags it: ${yn(v.desktop)}`), `${row.id} desktop`);
      assert.ok(notes.includes(`Pixel comparison at 390x844 flags it: ${yn(v.mobile)}`), `${row.id} phone`);
    } else {
      assert.ok(notes.includes('Not applicable: a change task starts from the clean app.'), row.id);
      assert.equal(v.desktop || v.mobile, false, `${row.id}: a change task's seed must not show`);
    }
  }
});

test('every fix task shows in a screenshot at one of the two sizes', () => {
  for (const row of rows.filter((r) => r.type === 'fix')) {
    const v = visibility.tasks[row.id];
    assert.ok(v.desktop || v.mobile, `${row.id} is invisible to any screenshot`);
  }
});
