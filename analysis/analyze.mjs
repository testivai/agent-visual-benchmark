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

// One row per task: each arm's rate over its repeats, by `key` (success or lenient_success).
function perTask(scored, arms, key = 'success') {
  return [...new Set(scored.map((r) => r.task))].sort().map((task) => {
    const runs = scored.filter((r) => r.task === task);
    const row = { task, type: runs[0].task_type, category: runs[0].task_category };
    for (const arm of arms) {
      const mine = runs.filter((r) => r.arm === arm);
      row[arm] = mine.length ? count(mine, (r) => r[key] === true) / mine.length : null;
      row[`n${arm}`] = mine.length;
    }
    return row;
  });
}

function paired(tasks, [x, y], options) {
  const diffs = tasks.filter((t) => t[x] !== null && t[y] !== null).map((t) => t[x] - t[y]);
  return bootstrapMean(diffs, options);
}

// C-B, C-A and B-A, paired by task, over the given task rows.
function pairedSet(tasks, arms, options) {
  const pairs = PAIRS.filter(([x, y]) => arms.includes(x) && arms.includes(y));
  return { tasks: tasks.map((t) => t.task), ...Object.fromEntries(pairs.map((p) => [`${p[0]}-${p[1]}`, paired(tasks, p, options)])) };
}

// PREREGISTRATION.md, section 7: the primary metric is over the fix and change
// tasks; decoys are their own result.
const isDecoy = (r) => r.task_type === 'decoy';

// Section 8: the symptom gone, values restored or not, over the fix and change tasks.
// A run without a lenient verdict is left out of this rate only.
function lenientStats(primaryRuns, arms, options) {
  const judged = primaryRuns.filter((r) => typeof r.lenient_success === 'boolean');
  const perArm = Object.fromEntries(arms.map((arm) => {
    const mine = judged.filter((r) => r.arm === arm);
    const successes = count(mine, (r) => r.lenient_success === true);
    return [arm, { n: mine.length, successes, wilson: wilson(successes, mine.length) }];
  }));
  return { perArm, paired: pairedSet(perTask(judged, arms, 'lenient_success'), arms, options) };
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
    runs: {
      total: finals.length, scored: scored.length, errors: errored.length, attempts: records.length, errorShare: finals.length ? errored.length / finals.length : 0,
    },
    errored: errored.map((r) => ({ run_id: r.run_id, task: r.task, arm: r.arm, stage: r.error.stage, message: r.error.message })),
    perArm: Object.fromEntries(arms.map((arm) => [arm, armStats(scored.filter((r) => r.arm === arm))])),
    byType: byGroup(scored, arms, 'task_type'),
    byCategory: byGroup(scored, arms, 'task_category'),
    perTask: tasks,
    primary: pairedSet(tasks.filter((t) => !isDecoy({ task_type: t.type })), arms, options),
    decoys: pairedSet(tasks.filter((t) => isDecoy({ task_type: t.type })), arms, options),
    lenient: lenientStats(scored.filter((r) => !isDecoy(r)), arms, options),
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

function pairedTable(set) {
  const rows = Object.entries(set).filter(([key]) => key !== 'tasks');
  return [
    '| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(([pair, p]) => `| ${pair} | ${p.n} | ${signed(p.mean)} | ${signed(p.low)} to ${signed(p.high)} | ${signed(p.lowerOneSided)} |`),
  ];
}

const KILL_POINTS = 0.10;

// PREREGISTRATION.md, sections 4 and 10: H1 and the kill line, judged on the
// primary model's full study only.
function verdictSection(result, { phase, primary }) {
  if (phase !== 'full') return [];
  if (!primary) {
    return ['This model is a replication (PREREGISTRATION.md, section 4): its comparisons are description, not a test of H1.', ''];
  }
  const cb = result.primary['C-B'];
  if (!cb || cb.mean === null) return ['## H1 and the kill line', '', 'No C-B comparison: no paired fix or change tasks.', ''];
  const supported = cb.lowerOneSided > 0;
  const killed = cb.mean < KILL_POINTS || cb.lowerOneSided <= 0;
  return [
    '## H1 and the kill line (preregistered)',
    '',
    `- C − B over the ${cb.n} fix and change tasks: ${signed(cb.mean)}; one-sided 95% interval: above ${signed(cb.lowerOneSided)}.`,
    `- ${supported ? 'H1 is supported' : 'H1 is not supported'}: the one-sided interval ${supported ? 'lies above' : 'reaches'} 0.`,
    killed
      ? '- The kill line was reached (under 10 points, or the one-sided interval reaches 0): TestivAI did not measurably help over a pixel comparison in this study.'
      : '- The kill line was not reached: the difference is at least 10 points and the one-sided interval lies above 0.',
    '',
  ];
}

function lenientSection(result, arms) {
  const l = result.lenient;
  return [
    '## Lenient rate: the symptom gone, values restored or not (fix and change tasks)',
    '',
    `| arm | ${arms.join(' | ')} |`,
    `| --- | ${arms.map(() => '---').join(' | ')} |`,
    `| lenient success | ${arms.map((a) => `${l.perArm[a].successes}/${l.perArm[a].n} ${ci(l.perArm[a].wilson)}`).join(' | ')} |`,
    `| strict success | ${arms.map((a) => strictPrimary(result, a)).join(' | ')} |`,
    '',
    ...pairedTable(l.paired),
    '',
  ];
}

function strictPrimary(result, arm) {
  const groups = ['fix', 'change'].map((type) => result.byType[type]?.[arm]).filter(Boolean);
  const k = groups.reduce((sum, g) => sum + g.successes, 0);
  const n = groups.reduce((sum, g) => sum + g.n, 0);
  return `${k}/${n} ${ci(wilson(k, n))}`;
}

function errorWarning(result) {
  if (result.runs.errorShare <= 0.05) return [];
  return [`**More than 5% of runs ended in an error twice (${pct(result.runs.errorShare)}).** They are left out of every rate below and listed at the end.`, ''];
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

export function renderSummary(result, { phase, model, primary = false }) {
  const arms = Object.keys(result.perArm);
  const lines = [
    `# Results: ${model ? `${model}, ` : ''}${phase}`,
    '',
    `Runs: ${result.runs.total} (${result.runs.attempts} attempts). Scored: ${result.runs.scored}. Errors: ${result.runs.errors} (excluded from the rates below, listed at the end).`,
    '',
    ...errorWarning(result),
  ];
  if (phase === 'pilot') {
    lines.push('**This is the pilot. It is too small for conclusions: no significance claims are made from it.** It measures cost and finds broken or uninformative tasks.', '');
  }
  lines.push(...verdictSection(result, { phase, primary }));
  lines.push('## Per arm', '', ...armTable(result, arms), '');
  lines.push('## Paired by task: fix and change tasks (the primary metric)', '', 'Each task\'s success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks '
    + `(${result.bootstrap.resamples} resamples, seed ${result.bootstrap.seed}).`, '');
  lines.push(...pairedTable(result.primary), '');
  lines.push('## Decoys, on their own', '', ...pairedTable(result.decoys), '');
  lines.push(...lenientSection(result, arms));
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
  'symptom_fixed', 'lenient_success', 'collateral_clean', 'tampered', 'claimed_done', 'false_done', 'stop_reason', 'turns', 'tokens', 'cost_usd', 'cost_source', 'seconds', 'flags', 'error'];

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
  fs.writeFileSync(path.join(dir, 'summary.md'), renderSummary(result, { phase, model, primary: model === primaryModelId(root) }));
  fs.writeFileSync(path.join(dir, 'csv', 'runs.csv'), toCsv(records, RUN_COLUMNS));
  fs.writeFileSync(path.join(dir, 'csv', 'per_task.csv'), toCsv(result.perTask, ['task', 'type', 'category', 'A', 'nA', 'B', 'nB', 'C', 'nC']));
  const armRows = Object.entries(result.perArm).map(([arm, s]) => ({ arm, n: s.n, successes: s.successes, rate: s.wilson.rate, low: s.wilson.low, high: s.wilson.high,
    false_done: s.falseDone.k, collateral_broken: s.collateralBroken.k, tampered: s.tampered, median_turns: s.medianTurns, median_tokens: s.medianTokens,
    median_seconds: s.medianSeconds, median_cost: s.medianCost, total_cost: s.totalCost }));
  fs.writeFileSync(path.join(dir, 'csv', 'per_arm.csv'), toCsv(armRows, Object.keys(armRows[0] ?? { arm: '' })));
  console.log(`wrote ${path.relative(root, path.join(dir, 'summary.md'))} and ${path.relative(root, path.join(dir, 'csv'))}/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
