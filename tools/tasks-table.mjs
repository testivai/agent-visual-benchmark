#!/usr/bin/env node
// Writes TASKS.md, the table of tasks for readers, from the task files.
//   node tools/tasks-table.mjs          write TASKS.md
//   node tools/tasks-table.mjs --check  exit 1 if TASKS.md is out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../harness/workspace.mjs';

const taskIds = (benchRoot) => fs.readdirSync(path.join(benchRoot, 'tasks')).sort();

export async function taskRows(benchRoot) {
  const rows = [];
  for (const id of taskIds(benchRoot)) {
    const task = JSON.parse(fs.readFileSync(path.join(benchRoot, 'tasks', id, 'task.json'), 'utf8'));
    const { summary } = await import(pathToFileURL(path.join(benchRoot, 'oracle', id, 'edits.mjs')).href);
    rows.push({ id, type: task.type, category: task.category, pages: task.pages, summary });
  }
  return rows;
}

const count = (rows, test) => rows.filter(test).length;
const yn = (b) => (b ? 'yes' : 'no');

function screenshotCell(row, visibility) {
  if (row.type === 'change') return 'n/a';
  const v = visibility.tasks[row.id];
  return `${yn(v.desktop)} / ${yn(v.mobile)}`;
}

export async function renderTasksTable(benchRoot) {
  const rows = await taskRows(benchRoot);
  const visibility = JSON.parse(fs.readFileSync(path.join(benchRoot, 'oracle', 'visibility.json'), 'utf8'));
  const fix = rows.filter((r) => r.type === 'fix');
  const categories = [...new Set(fix.map((r) => r.category))].sort();
  const hidden = fix.filter((r) => !visibility.tasks[r.id].desktop).map((r) => r.id);
  const quiet = rows.filter((r) => r.type === 'decoy' && !visibility.tasks[r.id].desktop && !visibility.tasks[r.id].mobile).map((r) => r.id);
  const lines = [
    '# Tasks',
    '',
    'This file is for readers. It is never given to the agent, and neither is anything under `oracle/`.',
    'It is generated from the task files: `node tools/tasks-table.mjs`.',
    '',
    `${rows.length} tasks: ${fix.length} fix, ${count(rows, (r) => r.type === 'change')} change, ${count(rows, (r) => r.type === 'decoy')} decoy.`,
    '',
    '- **fix**: a seeded visual regression and a vague report. Scored: everything the seed changed is back, and nothing else changed.',
    '- **change**: an intended change where the obvious edit to shared CSS also changes another page. Scored: the change is made, and nothing else changed.',
    '- **decoy**: nothing is wrong. Scored: no file under `site/` is changed.',
    '',
    'Fix tasks by category:',
    '',
    ...categories.map((c) => `- ${c}: ${fix.filter((r) => r.category === c).map((r) => r.id).join(', ')}`),
    '',
    '| id | type | category | pages | what it is | a screenshot shows it (1280x800 / 390x844) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.id} | ${r.type} | ${r.category} | ${r.pages.length === 6 ? 'all' : r.pages.join(', ')} | ${r.summary} | ${screenshotCell(r, visibility)} |`),
    '',
    'The last column is measured, not judged: full-page screenshots of the clean and the seeded app are',
    "compared pixel by pixel at Playwright's default threshold (`npm run visibility`, results in",
    '`oracle/visibility.json`). For a decoy it says whether a pixel comparison flags anything. It is a',
    'property of the task. It is never used to score a run.',
    '',
    '## Flags',
    '',
    `- **Not visible at the default viewport (1280x800): ${hidden.join(', ') || 'none'}.** These defects exist only under the 720px breakpoint. An arm`,
    '  whose screenshots are taken at desktop width only cannot see them. Their reports say "on my phone".',
    `- **Decoys where no pixel is flagged: ${quiet.join(', ') || 'none'}.** These are controls: every tool should say "no difference". The other`,
    '  decoys produce pixel differences above the default threshold with nothing wrong.',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const file = path.join(REPO_ROOT, 'TASKS.md');
  const text = await renderTasksTable(REPO_ROOT);
  if (process.argv.includes('--check')) {
    const ok = fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text;
    console.log(ok ? 'TASKS.md is up to date' : 'TASKS.md is out of date: run node tools/tasks-table.mjs');
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(file, text);
  console.log('wrote TASKS.md');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
