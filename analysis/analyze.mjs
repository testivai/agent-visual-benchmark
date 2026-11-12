#!/usr/bin/env node
// npm run analyze -- --model <id> --phase pilot|full
// Reads results/<model>/<phase>/runs.jsonl, writes summary.md and csv/ next to it.
// --model defaults to the primary model in runner.config.json. Each model is
// analysed on its own: models are never pooled.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson, median, bootstrapMean, finalRecords } from './stats.mjs';

const PAIRS = [['C', 'B'], ['C', 'A'], ['B', 'A']];

const count = (runs, test) => runs.filter(test).length;
const totalTokens = (r) => (r.tokens ? r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite : null);
const rate = (k, n) => ({ k, n, rate: n ? k / n : null });

function armStats(runs) {
  const successes = count(runs, (r) => r.success === true);
  return {
    n: runs.length,
    successes,
    wilson: wilson(successes, runs.length),
    falseDone: rate(count(runs, (r) => r.false_done === true), count(runs, (r) => r.false_done !== null && r.false_done !== undefined)),
    collateralBroken: rate(count(runs, (r) => r.collateral_clean === false), runs.length),
    tampered: count(runs, (r) => r.tampered === true),
    medianTurns: median(runs.map((r) => r.turns)),
    medianTokens: median(runs.map(totalTokens)),
    medianSeconds: median(runs.map((r) => r.seconds)),
    medianCost: median(runs.map((r) => r.cost_usd)),
    totalCost: runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0),
  };
}

function byGroup(scored, arms, key) {
  const out = {};
  for (const value of [...new Set(scored.map((r) => r[key]))].sort()) {
    out[value] = Object.fromEntries(arms.map((arm) => [arm, armStats(scored.filter((r) => r[key] === value && r.arm === arm))]));
  }
  return out;
}

function perTask(scored, arms) {
  return [...new Set(scored.map((r) => r.task))].sort().map((task) => {
    const runs = scored.filter((r) => r.task === task);
    const row = { task, type: runs[0].task_type, category: runs[0].task_category };
    for (const arm of arms) {
      const mine = runs.filter((r) => r.arm === arm);
      row[arm] = mine.length ? count(mine, (r) => r.success === true) / mine.length : null;
      row[`n${arm}`] = mine.length;
    }
    return row;
  });
}

function paired(tasks, [x, y], options) {
  const diffs = tasks.filter((t) => t[x] !== null && t[y] !== null).map((t) => t[x] - t[y]);
  return bootstrapMean(diffs, options);
}

function flagCounts(scored, arms) {
  return Object.fromEntries(arms.map((arm) => {
    const counts = {};
    for (const r of scored.filter((x) => x.arm === arm)) {
      for (const f of r.flags ?? []) counts[f] = (counts[f] ?? 0) + 1;
    }
    return [arm, counts];
  }));
}

function extremes(tasks, arms) {
  return tasks
    .filter((t) => arms.every((a) => t[a] !== null))
    .filter((t) => arms.every((a) => t[a] === 1) || arms.every((a) => t[a] === 0))
    .map((t) => ({ task: t.task, all: t[arms[0]] }));
}

export function analyze(records, { arms = ['A', 'B', 'C'], resamples = 10000, seed = 1, fullRuns = 360 } = {}) {
  const finals = finalRecords(records);
  const scored = finals.filter((r) => !r.error && r.success !== null && r.success !== undefined);
  const errored = finals.filter((r) => r.error);
  const tasks = perTask(scored, arms);
  const options = { resamples, seed };
  const costs = scored.map((r) => r.cost_usd).filter((c) => typeof c === 'number');
  const meanPerRun = costs.length ? costs.reduce((s, c) => s + c, 0) / costs.length : null;
  const secs = scored.map((r) => r.seconds).filter((s) => typeof s === 'number');
  return {
    runs: { total: finals.length, scored: scored.length, errors: errored.length, attempts: records.length },
    errored: errored.map((r) => ({ run_id: r.run_id, task: r.task, arm: r.arm, stage: r.error.stage, message: r.error.message })),
    perArm: Object.fromEntries(arms.map((arm) => [arm, armStats(scored.filter((r) => r.arm === arm))])),
    byType: byGroup(scored, arms, 'task_type'),
    byCategory: byGroup(scored, arms, 'task_category'),
    perTask: tasks,
    paired: Object.fromEntries(PAIRS.filter(([x, y]) => arms.includes(x) && arms.includes(y)).map((p) => [`${p[0]}-${p[1]}`, paired(tasks, p, options)])),
    bBeatC: tasks.filter((t) => t.B !== null && t.C !== null && t.B > t.C),
    cBeatB: tasks.filter((t) => t.B !== null && t.C !== null && t.C > t.B),
    extremes: extremes(tasks, arms),
    flags: flagCounts(scored, arms),
    cost: {
      meanPerRun,
      medianPerRun: median(costs),
      meanSecondsPerRun: secs.length ? secs.reduce((s, x) => s + x, 0) / secs.length : null,
      total: costs.reduce((s, c) => s + c, 0),
      projectedFull: meanPerRun === null ? null : meanPerRun * fullRuns,
      fullRuns,
    },
    bootstrap: options,
  };
}

const pct = (x) => (x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(0)}%`);
const ci = (w) => (w.rate === null ? 'n/a' : `${pct(w.rate)} (${pct(w.low)} to ${pct(w.high)})`);
const num = (x, d = 0) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(d));
const usd = (x) => (x === null || x === undefined ? 'n/a' : `$${Number(x).toFixed(2)}`);
const signed = (x) => (x === null ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)} points`);

function armTable(result, arms) {
  return [
    '| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds | median cost |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...arms.map((a) => {
      const s = result.perArm[a];
      return `| ${a} | ${s.n} | ${ci(s.wilson)} | ${s.falseDone.k}/${s.falseDone.n} | ${s.collateralBroken.k}/${s.collateralBroken.n} | ${s.tampered} | ${num(s.medianTurns)} | ${num(s.medianTokens)} | ${num(s.medianSeconds)} | ${usd(s.medianCost)} |`;
    }),
  ];
}

function groupTable(groups, arms, label) {
  return [
    `| ${label} | ${arms.join(' | ')} |`,
    `| --- | ${arms.map(() => '---').join(' | ')} |`,
    ...Object.entries(groups).map(([name, byArm]) => `| ${name} | ${arms.map((a) => `${byArm[a].successes}/${byArm[a].n} ${ci(byArm[a].wilson)}`).join(' | ')} |`),
  ];
}

function taskRows(tasks, arms) {
  if (tasks.length === 0) return ['None.'];
  return [
    `| task | type | category | ${arms.join(' | ')} |`,
    `| --- | --- | --- | ${arms.map(() => '---').join(' | ')} |`,
    ...tasks.map((t) => `| ${t.task} | ${t.type} | ${t.category} | ${arms.map((a) => `${pct(t[a])} (n=${t[`n${a}`]})`).join(' | ')} |`),
  ];
}

function pilotSection(result) {
  const c = result.cost;
  return [
    '## Pilot: cost, time and tasks that cannot tell the arms apart',
    '',
    `- Measured cost per run: mean ${usd(c.meanPerRun)}, median ${usd(c.medianPerRun)}; total ${usd(c.total)}.`,
    `- Measured time per run: mean ${num(c.meanSecondsPerRun)} s.`,
    `- Projected cost of the full ${c.fullRuns} runs at the pilot's mean: ${usd(c.projectedFull)}. Tasks outside the pilot may cost more or less.`,
    `- Tasks where every arm scored 0% or every arm 100%: ${result.extremes.length ? result.extremes.map((e) => `${e.task} (${pct(e.all)})`).join(', ') : 'none'}.`,
    '',
  ];
}

export function renderSummary(result, { phase, model }) {
  const arms = Object.keys(result.perArm);
  const lines = [
    `# Results: ${model ? `${model}, ` : ''}${phase}`,
    '',
    `Runs: ${result.runs.total} (${result.runs.attempts} attempts). Scored: ${result.runs.scored}. Errors: ${result.runs.errors} (excluded from the rates below, listed at the end).`,
    '',
  ];
  if (phase === 'pilot') {
    lines.push('**This is the pilot. It is too small for conclusions: no significance claims are made from it.** It measures cost and finds broken or uninformative tasks.', '');
  }
  lines.push('## Per arm', '', ...armTable(result, arms), '');
  lines.push('## Paired by task', '', 'Each task\'s success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks '
    + `(${result.bootstrap.resamples} resamples, seed ${result.bootstrap.seed}).`, '');
  lines.push('| comparison | tasks | mean difference | 95% bootstrap interval |', '| --- | --- | --- | --- |');
  for (const [pair, p] of Object.entries(result.paired)) lines.push(`| ${pair} | ${p.n} | ${signed(p.mean)} | ${signed(p.low)} to ${signed(p.high)} |`);
  lines.push('');
  lines.push('## Tasks where B beat C', '', ...taskRows(result.bBeatC, arms), '');
  lines.push('## Tasks where C beat B', '', ...taskRows(result.cBeatB, arms), '');
  lines.push('## By task type', '', ...groupTable(result.byType, arms, 'type'), '');
  lines.push('## By category', '', ...groupTable(result.byCategory, arms, 'category'), '');
  lines.push('## Every task', '', ...taskRows(result.perTask, arms), '');
  if (phase === 'pilot') lines.push(...pilotSection(result));
  lines.push('## Signs of shortcuts', '', 'Counted from the tool calls in each transcript (see runner/transcript.mjs). Tampering is in the per-arm table: it makes a run a failure.', '');
  for (const arm of arms) {
    const f = Object.entries(result.flags[arm]);
    lines.push(`- ${arm}: ${f.length ? f.map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`);
  }
  lines.push('', '## Errors', '');
  lines.push(...(result.errored.length ? result.errored.map((e) => `- ${e.run_id} ${e.task}/${e.arm} (${e.stage}): ${String(e.message).split('\n')[0].slice(0, 200)}`) : ['None.']), '');
  return lines.join('\n');
}

export function toCsv(rows, columns) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${[columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`;
}

const RUN_COLUMNS = ['phase', 'run_id', 'order', 'attempt', 'task', 'task_type', 'task_category', 'arm', 'repeat', 'model_id', 'model', 'success', 'fixed',
  'collateral_clean', 'tampered', 'claimed_done', 'false_done', 'stop_reason', 'turns', 'tokens', 'cost_usd', 'cost_source', 'seconds', 'flags', 'error'];

function primaryModelId(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'runner.config.json'), 'utf8'));
  return Object.entries(config.models).find(([, m]) => m.primary)?.[0];
}

function main() {
  const argv = process.argv.slice(2);
  const value = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const phase = value('--phase', 'pilot');
  const model = value('--model', primaryModelId(root));
  const dir = path.join(root, 'results', model, phase);
  const file = path.join(dir, 'runs.jsonl');
  if (!fs.existsSync(file)) {
    console.error(`no ${path.relative(root, file)} yet`);
    process.exit(1);
  }
  const records = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const result = analyze(records, {});
  fs.mkdirSync(path.join(dir, 'csv'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'summary.md'), renderSummary(result, { phase, model }));
  fs.writeFileSync(path.join(dir, 'csv', 'runs.csv'), toCsv(records, RUN_COLUMNS));
  fs.writeFileSync(path.join(dir, 'csv', 'per_task.csv'), toCsv(result.perTask, ['task', 'type', 'category', 'A', 'nA', 'B', 'nB', 'C', 'nC']));
  const armRows = Object.entries(result.perArm).map(([arm, s]) => ({ arm, n: s.n, successes: s.successes, rate: s.wilson.rate, low: s.wilson.low, high: s.wilson.high,
    false_done: s.falseDone.k, collateral_broken: s.collateralBroken.k, tampered: s.tampered, median_turns: s.medianTurns, median_tokens: s.medianTokens,
    median_seconds: s.medianSeconds, median_cost: s.medianCost, total_cost: s.totalCost }));
  fs.writeFileSync(path.join(dir, 'csv', 'per_arm.csv'), toCsv(armRows, Object.keys(armRows[0] ?? { arm: '' })));
  console.log(`wrote ${path.relative(root, path.join(dir, 'summary.md'))} and ${path.relative(root, path.join(dir, 'csv'))}/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
