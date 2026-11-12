# Preregistration

**Status: draft.** Items marked **Decided** were decided by the maintainer. Items marked
**Proposed** are recommendations awaiting the maintainer's yes or change. Nothing is final until the
maintainer approves every item, commits this file and tags the commit (`git tag prereg-v1`), before
the first dry run. The pilots may be used to measure cost and to find broken tasks; they must not be
used to choose anything below after looking at which arm is ahead.

Later changes go in a "Deviations" section at the end, each with a date and a reason; the frozen text
is never edited.

## 1. Question

Does a coding agent fix visual UI bugs more often when it can use TestivAI than when it cannot?

## 2. Arms

Same agent, same model, same task prompts, same limits. Only the tooling differs (`arms/README.md`
lists every difference).

| arm | the agent has |
| --- | --- |
| A, blind | the app source and the functional tests |
| B, pixel | A, plus Playwright's built-in screenshot comparison and the diff images |
| C, TestivAI | A, plus TestivAI capture, its MCP server and `results.json` |

- B and C capture the same six pages at 1280x800 and 390x844, so both can see the two defects that
  exist only under 720px (t05, t20). **Decided** (the runner's setting since part 2).

## 3. Agent and models

**Decided** (2026-11-12):

| model | role | login | budget |
| --- | --- | --- | --- |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | **primary**: the hypotheses and the kill line are judged on it | the maintainer's Claude subscription | subscription (no dollar budget) |
| Claude Opus 5.5 (`claude-opus-5-5`) | replication | the same | subscription |
| DeepSeek-V4.1-Flash (`deepseek-flash`) | replication, a second model family | DeepSeek's API | $20 for the pilot |

- Each model is a study of its own: same tasks, arms and scoring, analysed on its own. Models are
  never pooled, and no model is chosen as primary after seeing results.
- A model that fails the image check (it cannot see a picture through the study's Claude Code) is
  skipped, because arm B gives the agent pictures and a text-only model would favour arm C by
  construction. DeepSeek-V4.1-Flash passed; DeepSeek-V4-Pro is text only and is not used
  (`docs/phase0-findings.md`).
- Agent: Claude Code 2.1.322 in print mode, locked down the same way for every model
  (`README.md`, "How a run works"; checks in `docs/phase0-findings.md`).
- Versions: Playwright 1.63.0, `@testivai/witness-playwright` 2.1.3, `@testivai/witness` 2.7.2,
  `@testivai/mcp` 0.9.4.
- **Proposed:** effort not set (Claude Code's default for each model), 60 turns, 30 minutes per run,
  and for the Claude models a spend cap of $10 per run at Claude Code's estimate. The committed
  `runner.config.json` holds these.

## 4. Hypotheses

- **Proposed** H1 (primary): on Sonnet 5.5, the success rate of arm C is higher than that of arm B,
  over the tasks in the primary metric (section 7).
- **Proposed** H2: on Sonnet 5.5, C is higher than A. H3: B is higher than A.
- **Proposed** replication: the same three comparisons on Opus 5.5 and on DeepSeek-V4.1-Flash,
  reported as replication, not as further tests of H1.
- **Proposed** direction: one-sided for H1 (the claim to be tested is that TestivAI helps), with the
  two-sided interval reported as well.

## 5. Tasks and runs

- Task set: this repository at the tagged commit (`TASKS.md` lists the tasks; `npm run validate` is
  green).
- Repeats per task per arm: 3 in a pilot (6 tasks, 54 runs per model), 5 in a full study (24 tasks,
  360 runs per model).
- Order of runs: randomised across arms with recorded seeds (`seeds.order`, and `seeds.pilotTasks`
  for the pilot's tasks, in `runner.config.json`); the same plan for every model.
- Which runs count: every run in `results/<model>/full/runs.jsonl`.
- A run that ends in an error is retried once, and both attempts stay in the file. A run cut off by a
  usage limit waits and runs again, and that does not use up the retry.
- **Proposed:** a run that ends in an error twice is left out of the success rates and listed, with
  its errors, in the results. If more than 5% of a model's runs end that way, the write-up says so
  before any result.
- **Proposed:** pilot runs are left out of the final analysis.

## 6. Outcome of one run

Decided by the hidden oracle in this repository, never by TestivAI and never by a screenshot
comparison (`README.md`, "How a run is scored").

- fix and change tasks: **success** = `score.spec.ts` passes AND `collateral.spec.ts` passes AND
  nothing protected was changed.
- decoy tasks: **success** = no file under `site/` changed AND nothing protected was changed.
- **Proposed:** changing, deleting or adding to tests, baselines, tool configuration or installed
  packages is a failure (`runner/tamper.mjs`; new test files are allowed).
- **Proposed:** "claimed done" is read from the last `STATUS: DONE` or `STATUS: NOT DONE` line of the
  agent's final message, which every arm's instructions ask for; a run without one makes no claim
  and is counted apart. `false_done` = claimed done AND not a success.

## 7. Primary metric

Success rate, arm C against arm B, on Sonnet 5.5.

- **Proposed:** over the 20 fix and change tasks. The 4 decoys are reported as their own result, beside
  it. Reason: decoys are where TestivAI is designed to help most (it labels a diff with an unchanged
  page and unchanged styles as likely render noise, and a pixel comparison cannot), so including
  them in the primary metric would favour arm C by construction.
- Unit of analysis: the task. Each task's rate is the mean of its repeats; repeats of one task are
  not independent runs.

## 8. Secondary metrics

- Success rate by task type (fix, change, decoy) and by fix category, per arm, with Wilson intervals.
- Collateral breakage rate (the rest of the site changed).
- False "done" rate.
- Turns, tokens, wall time and cost per run (median and spread); cost is API-equivalent for the
  subscription models and at DeepSeek's prices for DeepSeek.
- **Proposed:** a lenient fix rate beside the strict one. The scorer is strict: a fix must restore the
  values the page had, not only remove the symptom. Each fix task's `score.spec.ts` has one test for
  that (`everything the seed changed is back as it was`) and separate tests for the symptom.
  Reporting "symptom gone" beside "restored" shows how much of a difference between arms comes from
  knowing the exact original values, which a TestivAI baseline's recorded DOM and styles give arm C
  more directly than a screenshot gives arm B.

## 9. Analysis

- Per-arm success rate with a 95% Wilson interval: for description only.
- C against B, and C against A: paired by task, difference in per-task success rate, with a
  percentile bootstrap interval over tasks: 10,000 resamples, seed 1 (`analysis/analyze.mjs`).
- **Proposed** test for H1: the one-sided 95% bootstrap interval of C − B on Sonnet 5.5 (its lower
  bound is the 5th percentile of the resampled differences) lies above 0.
- **Proposed** several comparisons: only H1 is a test; everything else is reported as description,
  with its interval, and no claim of significance is made for it.
- The tasks where B beat C are listed as prominently as the tasks where C beat B.

## 10. Kill line

Written before the full run, and published whichever way it falls.

- **Proposed:** "If, on Sonnet 5.5 and the 20 fix and change tasks, the mean difference C − B is less
  than 10 percentage points, or its one-sided 95% interval reaches 0 or below, the write-up says that
  TestivAI did not measurably help over a pixel comparison in this study."

**What this design can detect.** With 20 tasks as the unit of analysis, the interval on a difference
between two arms will be wide: as a rough guide, plus or minus 15 to 20 percentage points, depending
on how much tasks differ. A true difference of 5 to 10 points will most likely not be distinguishable
from zero. The pilots give the spread between tasks; the expected width of the full study's interval
is added here from them, before the full run, without looking at which arm is ahead.

## 11. What the pilots may and may not change

- May: fix a task that is broken (all arms at 0% or 100% for a reason unrelated to the arms), fix the
  runner, adjust budgets.
- May not: tune prompts, arm instructions or tasks towards a result. Every change after a pilot is
  listed in `CHANGES_AFTER_PILOT.md`.

## 12. Known limits, to be stated in the write-up

- Three models, one agent (Claude Code). The result may not carry over to other agents.
- The Claude models run on a subscription: nothing is billed per run, and their cost figures are
  Claude Code's API-equivalent estimates.
- DeepSeek runs through Claude Code, a pairing Anthropic does not support.
- The tasks were written by the maker of TestivAI, with an AI assistant, who know what TestivAI
  reports. The categories were fixed before any task was written and the scoring is independent of
  TestivAI, but the choice of bugs is not blind.
- The scorer measures DOM, computed styles and boxes. A defect that exists only inside an image's
  pixels (a wrong picture, a canvas drawing) cannot be scored this way and is not in the set.
- A small static site. Real applications have dynamic content and more noise.
- The agent runs in a harness that differs from everyday use: exactly Bash, Read and Edit; no memory,
  plugins or skills; Bash in a sandbox (on Linux each command has its own `localhost`); and an
  instruction to end with a STATUS line. The same in every arm.

## Deviations

None yet.
