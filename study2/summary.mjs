// Study 2's summary in markdown (study2/PREREGISTRATION.md, section 10, step 7):
// the preregistered tests first, then the description. Built on study 1's
// tables (analysis/analyze.mjs); the numbers come from analyzeStudy2 and, for
// what is description only, describeStudy2 (study2/describe.mjs).
import { pct, num, usd, armTable, groupTable, taskRows, rederivedNote } from '../analysis/analyze.mjs';

const ARMS = ['B', 'C'];
const PRIMARY = ['S1', 'S2', 'S3'];
const KILL_POINTS = 0.10;

const points = (x) => (x === null || x === undefined ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} points`);
const times = (x) => (x === null || x === undefined ? 'n/a' : `${x.toFixed(2)}×`);
const p3 = (x) => (x === null || x === undefined ? 'n/a' : x.toFixed(3));

// study 1's paired table, in points with one decimal
function pairedTable(set) {
  const rows = Object.entries(set).filter(([key]) => key !== 'tasks');
  return [
    '| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(([pair, p]) => `| ${pair} | ${p.n} | ${points(p.mean)} | ${points(p.low)} to ${points(p.high)} | ${points(p.lowerOneSided)} |`),
  ];
}

function holmTable(holm) {
  return [
    '| test | p | Holm-adjusted p | rejected at 5% overall |',
    '| --- | --- | --- | --- |',
    ...holm.map((h) => `| ${h.test} | ${p3(h.p)} | ${p3(h.adjusted)} | ${h.rejected ? 'yes' : 'no'} |`),
  ];
}

// The most C − B can be over the S1 to S3 tasks, given B's rates.
function headroom(result) {
  const groups = PRIMARY.map((s) => result.byCategory[s]?.B).filter(Boolean);
  const k = groups.reduce((sum, g) => sum + g.successes, 0);
  const n = groups.reduce((sum, g) => sum + g.n, 0);
  const rows = result.perTask.filter((t) => t.type !== 'decoy' && t.B !== null && t.C !== null);
  const most = rows.length ? 1 - rows.reduce((sum, t) => sum + t.B, 0) / rows.length : null;
  return { k, n, most };
}

function verdictSection(result) {
  const { h1, h2, holm, verdict } = result;
  const room = headroom(result);
  const lines = [
    '## H1, H2 and the kill line (preregistered)',
    '',
    `- H1: C − B over the ${h1.tasks} S1 to S3 tasks: ${points(h1.mean)}; one-sided 95% bound: ${points(h1.lowerOneSided)}; bootstrap p = ${p3(h1.p)}.`,
    `- H2: C's tokens over B's (per-task median, paired, log scale) over ${h2.tasks} tasks: ${times(h2.ratio)} (95% interval ${times(h2.low)} to ${times(h2.high)}); two-sided bootstrap p = ${p3(h2.p)}.`,
    '',
    ...holmTable(holm),
    '',
    verdict.h1Supported
      ? '- H1 is supported: Holm\'s procedure rejects it, so C\'s success is higher than B\'s.'
      : '- H1 is not supported: Holm\'s procedure does not reject it.',
    verdict.h2Rejected
      ? '- H2: Holm\'s procedure rejects it, so C and B differ in tokens per run.'
      : '- H2: Holm\'s procedure does not reject it: no measurable difference in tokens per run.',
    verdict.killLine
      ? '- The kill line was reached (C − B under 10 points, or its one-sided interval reaches 0): TestivAI did not measurably help over a pixel comparison in study 2 either.'
      : '- The kill line was not reached: C − B is at least 10 points and its one-sided interval lies above 0.',
  ];
  if (room.most !== null && room.most < KILL_POINTS) {
    lines.push(`- B succeeded in ${room.k}/${room.n} S1 to S3 runs (${pct(room.k / room.n)}), so C − B could be at most ${points(room.most)}: the kill line's 10 points could not be reached whatever C did.`);
  }
  return [...lines, ''];
}

function effortSection(result, described) {
  const lines = [
    '## Effort by stratum (description, not a test)',
    '',
    'Medians per run. The last column is H2\'s measure taken in each stratum on its own (C\'s tokens over B\'s, the per-task median, paired), with its 95% bootstrap interval; it carries no p-value.',
    '',
    '| stratum | turns B | turns C | tokens B | tokens C | agent seconds B | agent seconds C | tokens C/B, per task |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const [stratum, byArm] of Object.entries(result.byCategory)) {
    const t = described.tokensByStratum[stratum];
    const ratio = t ? `${times(t.ratio)} (${times(t.low)} to ${times(t.high)})` : 'n/a';
    lines.push(`| ${stratum} | ${num(byArm.B.medianTurns)} | ${num(byArm.C.medianTurns)} | ${num(byArm.B.medianTokens)} | ${num(byArm.C.medianTokens)} | ${num(byArm.B.medianSeconds)} | ${num(byArm.C.medianSeconds)} | ${ratio} |`);
  }
  return [...lines, ''];
}

function partialSection(result) {
  const pc = result.partialCredit;
  return [
    '## Partial credit in S2 (description)',
    '',
    `- Mean share of a task's mutations restored: B ${num(pc.perArm.B.meanShare, 3)} over ${pc.perArm.B.runs} runs, C ${num(pc.perArm.C.meanShare, 3)} over ${pc.perArm.C.runs} runs.`,
    `- Paired by task, C − B: ${points(pc.paired.mean)} (95% interval ${points(pc.paired.low)} to ${points(pc.paired.high)}), over ${pc.paired.n} tasks.`,
    '- Known limit (PREREGISTRATION.md, section 5): where two mutations move the same elements, neither counts until both are restored there, so partial credit can undercount a half-done fix.',
    '',
  ];
}

const share = (p) => `${p.successes}/${p.runs} (${pct(p.rate)})`;
const sd = (s) => `${num(s.sd, 2)} over ${s.tasks} tasks`;

function pilotSection(pilot, described) {
  if (!pilot) return [];
  const full = described.calibration;
  return [
    '## Against the pilot that sized the study',
    '',
    'The pilot\'s own measures (study2/calibration.mjs), on the pilot and on the full study. The pilot ran on one site.',
    '',
    '| | pilot | full study |',
    '| --- | --- | --- |',
    `| pooled success, S1 to S3 | ${share(pilot.pooled)} | ${share(full.pooled)} |`,
    `| per-task SD of C − B | ${sd(pilot.spread)} | ${sd(full.spread)} |`,
    `| power at 60 tasks for a true 10 points | ${pct(pilot.spread.powerAt60)} | ${pct(full.spread.powerAt60)} |`,
    '',
  ];
}

function generationSection(g) {
  if (!g) return [];
  return [
    '## The task generation: which comparator flags the candidates',
    '',
    `Of the ${g.candidates} candidates drawn, ${g.visible} had a measured change on a rendered element and changed pixels. Playwright's comparator flagged ${g.playwright} of them and TestivAI's ${g.testivai}: ${g.onlyTestivai} only TestivAI's, ${g.onlyPlaywright} only Playwright's, ${g.neither} neither. The validity filter kept only what both flagged.`,
    '',
  ];
}

function flagSection(result) {
  const lines = [
    '## Signs of shortcuts',
    '',
    'Counted from the tool calls in each transcript (runner/transcript.mjs). Tampering, which fails a run, is in the per-arm table. outside_workspace counts any path outside the run\'s project and TMPDIR that is not a system directory: the run\'s own directory around them, and system files such as /etc/fonts, count too.',
    '',
  ];
  for (const arm of ARMS) {
    const f = Object.entries(result.flags[arm]).sort(([a], [b]) => a.localeCompare(b));
    lines.push(`- ${arm}: ${f.length ? f.map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`);
  }
  return [...lines, ''];
}

function costSection(result) {
  const c = result.cost;
  return [
    '## Cost (API-equivalent)',
    '',
    `- Total: ${usd(c.total)} over ${result.runs.scored} runs; B ${usd(result.perArm.B.totalCost)}, C ${usd(result.perArm.C.totalCost)}.`,
    `- Per run: mean ${usd(c.meanPerRun)}, median ${usd(c.medianPerRun)}; mean wall time ${num(c.meanSecondsPerRun)} s, waits included.`,
    '',
  ];
}

function errorSection(result) {
  const list = result.errored.map((e) => `- ${e.run_id} ${e.task}/${e.arm} (${e.stage}): ${String(e.message).split('\n')[0].slice(0, 200)}`);
  return ['## Errors', '', ...(list.length ? list : ['None.']), ''];
}

// result: analyzeStudy2; described: describeStudy2; pilot: the pilot's calibration
// record (optional); generation: generationChecks of the task set (optional);
// rederived: applyTranscripts' report (optional).
export function renderStudy2Summary(result, { model, phase, described, pilot = null, generation = null, rederived = null }) {
  const lines = [
    `# Study 2 results: ${model}, ${phase}`,
    '',
    `Runs: ${result.runs.total} (${result.runs.attempts} attempts). Scored: ${result.runs.scored}. Errors: ${result.runs.errors} (excluded from the rates below, listed at the end).`,
    '',
    ...rederivedNote(rederived),
  ];
  if (result.runs.errorShare > 0.05) lines.push(`**More than 5% of runs ended in an error twice (${pct(result.runs.errorShare)}).**`, '');
  lines.push(...verdictSection(result));
  lines.push('## Per arm', '', ...armTable(result, ARMS), '');
  lines.push('## Success by stratum', '', 'S1 to S3 are the primary tasks; S3 and S4 have drifted baselines; S4 is the decoys (nothing to fix).', '', ...groupTable(result.byCategory, ARMS, 'stratum'), '');
  lines.push(...effortSection(result, described));
  lines.push('## Paired by task: S1 to S3 (the primary metric)', '', `Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (${result.bootstrap.resamples} resamples, seed ${result.bootstrap.seed}).`, '');
  lines.push(...pairedTable(result.primary), '');
  lines.push('## Decoys (S4), on their own', '', ...pairedTable(result.decoys), '');
  lines.push(...partialSection(result));
  lines.push('## Tasks where B beat C', '', ...taskRows(result.bBeatC, ARMS), '');
  lines.push('## Tasks where C beat B', '', ...taskRows(result.cBeatB, ARMS), '');
  lines.push(...pilotSection(pilot, described));
  lines.push(...generationSection(generation));
  lines.push('## Every task', '', ...taskRows(result.perTask, ARMS), '');
  lines.push(...flagSection(result), ...costSection(result), ...errorSection(result));
  return lines.join('\n');
}
