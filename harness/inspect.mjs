#!/usr/bin/env node
// Shows, for one task, what its patches change in measured terms.
//   node harness/inspect.mjs t03
import path from 'node:path';
import { chromium } from '@playwright/test';
import { REPO_ROOT, makeWorkspace, removeWorkspace } from './workspace.mjs';
import { startStaticServer } from './static-server.mjs';
import { captureSnapshot } from '../oracle/lib/capture.mjs';
import { getTaskContext, taskFiles } from '../oracle/lib/context.mjs';
import { diffSnapshots, checkRestored, checkCollateral, describeEntry } from '../oracle/lib/compare.mjs';

const id = process.argv[2];
const limit = Number(process.argv[3] ?? 12);
if (!id) {
  console.error('usage: node harness/inspect.mjs <task id> [lines]');
  process.exit(2);
}

function byView(entries) {
  const counts = {};
  for (const e of entries) counts[e.split('|')[0]] = (counts[e.split('|')[0]] ?? 0) + 1;
  return Object.entries(counts).map(([v, n]) => `${v}: ${n}`).join(', ');
}

function show(title, entries, describe = (e) => e) {
  console.log(`\n${title}: ${entries.length}`);
  if (entries.length > 0) console.log(`  ${byView(entries.map((e) => e.entry ?? e))}`);
  for (const e of entries.slice(0, limit)) console.log(`  ${describe(e)}`);
  if (entries.length > limit) console.log(`  … ${entries.length - limit} more`);
}

const browser = await chromium.launch();
try {
  const ctx = await getTaskContext(browser, REPO_ROOT, id);
  console.log(`${id}  ${ctx.task.type} / ${ctx.task.category}`);
  show('seed changes (clean vs seeded)', diffSnapshots(ctx.clean, ctx.seeded));
  ctx.solutions.forEach((s, i) => show(`solution ${i} leaves different from clean`, diffSnapshots(ctx.clean, s)));
  console.log(`\nmust restore: ${ctx.scope.mustRestore.size}   free: ${ctx.scope.free.size}`);

  const wrongWs = makeWorkspace({
    appDir: path.join(REPO_ROOT, 'app'),
    patches: [taskFiles(REPO_ROOT, id).seed, path.join(REPO_ROOT, 'oracle', id, 'wrong.patch')],
    label: 'inspect',
  });
  const server = await startStaticServer(path.join(wrongWs, 'site'));
  try {
    const wrong = await captureSnapshot(browser, server.url);
    show('wrong fix: not restored', checkRestored(ctx.clean, wrong, ctx.scope), describeEntry);
    show('wrong fix: collateral', checkCollateral(ctx.clean, wrong, ctx.scope), describeEntry);
  } finally {
    await server.close();
    removeWorkspace(wrongWs);
  }
} finally {
  await browser.close();
}
