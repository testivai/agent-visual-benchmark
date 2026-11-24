import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStudy2 } from './analysis.mjs';
import { describeStudy2, generationChecks } from './describe.mjs';
import { renderStudy2Summary } from './summary.mjs';

const STRATA = ['S1', 'S2', 'S3', 'S4'];

// n tasks per stratum, 3 repeats per arm. success(arm, stratum, task, repeat) -> boolean.
function study(n, success, { cTokens = 300, bTokens = 200 } = {}) {
  const tasks = [];
  const records = [];
  for (const stratum of STRATA) {
    for (let i = 0; i < n; i++) {
      const id = `${stratum}-${i}`;
      tasks.push({ id, stratum });
      for (const arm of ['B', 'C']) {
        for (let repeat = 1; repeat <= 3; repeat++) {
          const ok = success(arm, stratum, i, repeat);
          records.push({
            run_id: `${id}-${arm}-${repeat}`, attempt: 1, task: id, arm, repeat, success: ok, error: null,
            claimed_done: true, false_done: !ok, collateral_clean: true, tampered: false, flags: [],
            turns: 10, seconds: 30, agent_seconds: 25, cost_usd: 0.2,
            tokens: { input: (arm === 'C' ? cTokens : bTokens) + i, output: 0, cacheRead: 0, cacheWrite: 0 },
            ...(stratum === 'S2' ? { partial_credit: { share: ok ? 1 : 0.5 } } : {}),
          });
        }
      }
    }
  }
  return { tasks, records };
}

function render(s, extra = {}) {
  const result = analyzeStudy2(s.records, { tasks: s.tasks, resamples: 500 });
  const described = describeStudy2(s.records, { tasks: s.tasks, resamples: 500 });
  return renderStudy2Summary(result, { model: 'sonnet', phase: 'full', described, ...extra });
}

test('a null result: H1 not supported, the kill line reached, in the preregistered words', () => {
  // in S1 to S3, B fails one repeat of the even tasks, C one of the odd: a mean of 0
  const s = study(6, (arm, stratum, i, repeat) => !(stratum !== 'S4' && repeat === 1 && (arm === 'B') === (i % 2 === 0)));
  const md = render(s);
  assert.match(md, /- H1: C − B over the 18 S1 to S3 tasks: \+0\.0 points;/);
  assert.match(md, /\| C-B \| 18 \| \+0\.0 points \| -\d+\.\d points to \+\d+\.\d points \| -\d+\.\d points \|/, 'the paired table in points with one decimal');
  assert.match(md, /^# Study 2 results: sonnet, full$/m);
  assert.match(md, /- H1 is not supported: Holm's procedure does not reject it\./);
  assert.match(md, /The kill line was reached .*: TestivAI did not measurably help over a pixel comparison in study 2 either\./);
  assert.match(md, /\| H1 \| \d\.\d{3} \| \d\.\d{3} \| no \|/);
  assert.match(md, /\| H2 \| \d\.\d{3} \| \d\.\d{3} \| (yes|no) \|/);
  assert.doesNotMatch(md, /H1 is supported/);
});

test('a clear result: H1 supported and the kill line not reached', () => {
  const s = study(6, (arm, stratum, i, repeat) => arm === 'C' || stratum === 'S4' || repeat === 1);
  const md = render(s);
  assert.match(md, /- H1 is supported: Holm's procedure rejects it/);
  assert.match(md, /- The kill line was not reached/);
});

test('C − B and its bound in points with one decimal, H2 as a ratio with its interval', () => {
  const s = study(6, (arm, stratum, i, repeat) => !(stratum !== 'S4' && repeat === 1 && (arm === 'B' || i % 2 === 0)));
  const md = render(s);
  assert.match(md, /- H1: C − B over the 18 S1 to S3 tasks: \+16\.7 points; one-sided 95% bound: [+-]\d+\.\d points; bootstrap p = \d\.\d{3}\./);
  assert.match(md, /- H2: C's tokens over B's .*: 1\.\d\d× \(95% interval 1\.\d\d× to 1\.\d\d×\); two-sided bootstrap p = \d\.\d{3}\./);
});

test('the headroom: when B leaves less than the kill line\'s 10 points, the summary says so', () => {
  const nearCeiling = study(10, (arm, stratum, i, repeat) => !(arm === 'B' && stratum === 'S1' && i === 0 && repeat === 1));
  assert.match(render(nearCeiling), /B succeeded in 89\/90 S1 to S3 runs \(99%\), so C − B could be at most \+1\.1 points: the kill line's 10 points could not be reached whatever C did\./);
  const room = study(6, (arm, stratum, i, repeat) => arm === 'C' || stratum === 'S4' || repeat === 1);
  assert.doesNotMatch(render(room), /could not be reached whatever C did/);
});

test('tokens and turns per stratum, and C/B tokens per stratum, marked as description', () => {
  const md = render(study(4, () => true));
  assert.match(md, /## Effort by stratum \(description, not a test\)/);
  assert.match(md, /\| S3 \| 10 \| 10 \| \d+ \| \d+ \| 25 \| 25 \| 1\.\d\d× \(1\.\d\d× to 1\.\d\d×\) \|/);
});

test('beside the pilot that sized the study, when the pilot\'s calibration is given', () => {
  const s = study(6, (arm, stratum, i, repeat) => !(stratum !== 'S4' && repeat === 1 && (arm === 'B' || i % 2 === 0)));
  const pilot = { pooled: { successes: 30, runs: 36, rate: 30 / 36 }, spread: { sd: 0, tasks: 6, powerAt60: 1 } };
  const md = render(s, { pilot });
  assert.match(md, /\| pooled success, S1 to S3 \| 30\/36 \(83%\) \| \d+\/108 \(\d+%\) \|/);
  assert.match(md, /\| per-task SD of C − B \| 0\.00 over 6 tasks \| 0\.\d\d over 18 tasks \|/);
  assert.doesNotMatch(render(s), /## Against the pilot/);
});

test('the generation\'s comparators, when the task set\'s stats are given', () => {
  const stats = { candidates: 317, kept: 120, byClass: { colour: { kept: 120, rejected: { "arm B's check (Playwright) does not flag it": 2, "neither arm's check flags it": 2 } } } };
  const md = render(study(2, () => true), { generation: generationChecks(stats) });
  assert.match(md, /Of the 317 candidates drawn, 124 had a measured change on a rendered element and changed pixels\. Playwright's comparator flagged 120 of them and TestivAI's 122: 2 only TestivAI's, 0 only Playwright's, 2 neither\./);
});

test('partial credit with its known limit, the tasks each arm won, flags, errors, and the re-read transcripts', () => {
  const s = study(3, (arm, stratum, i, repeat) => !(stratum === 'S2' && arm === 'B' && repeat === 1));
  s.records[0].flags = ['outside_workspace', 'viewed_baseline'];
  const md = render(s, { rederived: { checked: 48, missing: 0, changed: [] } });
  assert.match(md, /## Partial credit in S2 \(description\)/);
  assert.match(md, /can undercount a half-done fix/);
  assert.match(md, /## Tasks where B beat C\n\nNone\./);
  assert.match(md, /## Tasks where C beat B\n\n\| task \|/);
  assert.match(md, /- B: outside_workspace 1, viewed_baseline 1/);
  assert.match(md, /0 of 48 runs differ from runs\.jsonl/);
  assert.match(md, /## Errors\n\nNone\./);
});
