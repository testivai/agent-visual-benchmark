# Preregistration

**Status: skeleton. Nothing below is decided until the maintainer fills it in, commits it and tags
the commit, before any run that counts.** Every `TODO` is a decision to make in advance. The pilot
may be used to measure cost and to find broken tasks; it must not be used to choose these numbers
after looking at which arm is ahead.

How to freeze it: fill in every `TODO`, commit, then `git tag prereg-v1 && git push --tags`. The
write-up links to that tag. Later changes go in a "Deviations" section at the end, each with a date
and a reason; the frozen text is never edited.

## 1. Question

Does a coding agent fix visual UI bugs more often when it can use TestivAI than when it cannot?

## 2. Arms

Same agent, same model, same task prompts, same turn and time limits. Only the tooling differs.

| arm | the agent has |
| --- | --- |
| A, blind | the app source and the functional tests |
| B, pixel | A, plus Playwright's built-in screenshot comparison and the diff images |
| C, TestivAI | A, plus TestivAI capture, its MCP server and `results.json` |

- Agent and version: TODO
- Model and exact id: TODO
- Turn limit: TODO. Time limit: TODO
- Versions of Playwright, `@testivai/witness-playwright`, `@testivai/mcp`: TODO (pinned, exact)
- Viewports at which arms B and C capture: TODO. **Decide this knowingly:** tasks t05 and t20 are
  defects under the 720px breakpoint only (see `TASKS.md`, "Flags"). If B and C capture at desktop
  width only, neither can see them, and those two tasks measure something else: whether the agent
  thinks of checking a phone size by itself. Whatever is chosen must be the same for B and C.

## 3. Hypotheses

- H1 (primary): TODO. For example: "the success rate of arm C is higher than that of arm B".
- H2: TODO (C against A)
- H3: TODO (B against A)
- Direction and whether the test is one-sided or two-sided: TODO

## 4. Tasks and runs

- Task set: this repository at commit TODO (`TASKS.md` lists the tasks; `npm run validate` is green).
- Repeats per task per arm: TODO (the plan says 5: 24 x 3 x 5 = 360 runs)
- Order of runs: randomised across arms, seed recorded: TODO
- Which runs count: every run in `results/runs.jsonl`. A run that ends in a harness error is retried
  once and both attempts stay in the file. Rule for a run that errors twice: TODO

## 5. Outcome of one run

Decided by the hidden oracle in this repository, never by TestivAI and never by a screenshot
comparison (see `README.md`, "How a run is scored").

- fix and change tasks: **success** = `score.spec.ts` passes AND `collateral.spec.ts` passes
- decoy tasks: **success** = no file under `site/` changed
- Edits to test files, baselines or tool configuration count as: TODO (the plan says failure)
- `false_done` = the agent claimed it was done AND the run is not a success. How "claimed done" is
  read from the transcript: TODO

## 6. Primary metric

Success rate, arm C against arm B.

- Over which tasks: TODO. **Decide this knowingly:** decoys are where TestivAI is designed to help
  most (it labels a diff with an unchanged DOM and unchanged styles as likely render noise, and a
  pixel comparison cannot). Including the 4 decoys in the primary metric favours arm C by
  construction; excluding them hides a real part of the question. Options: (a) all 24 tasks;
  (b) the 20 fix and change tasks, with decoys reported separately; (c) both, naming one as primary.
- Unit of analysis: the task. Each task's rate is the mean of its repeats; repeats of one task are
  not independent runs.

## 7. Secondary metrics

- success rate by task type (fix, change, decoy) and by fix category: TODO which are reported
- collateral breakage rate (score passes, collateral fails)
- false "done" rate
- turns, tokens in and out, wall time per run (median and spread)
- a lenient fix rate, yes or no: TODO. The scorer is strict: a fix must restore the values the page
  had, not only remove the symptom. Each fix task's `score.spec.ts` has one test for that
  (`everything the seed changed is back as it was`) and separate hand-written tests for the symptom.
  Reporting "symptom gone" beside "restored" would show how much of any difference between arms
  comes from knowing the exact original values, which a baseline's recorded DOM and styles give
  arm C more directly than a screenshot gives arm B.
- TODO: anything else, named now

## 8. Analysis

- Per-arm success rate with a 95% Wilson interval: for description only.
- C against B, and C against A: paired by task, difference in per-task success rate, with a
  bootstrap interval over tasks (TODO: number of resamples, interval level, seed).
- Test and threshold for H1: TODO
- Corrections for several comparisons: TODO
- The tasks where B beat C are listed as prominently as the tasks where C beat B.

## 9. Kill line

Written before the full run, and published whichever way it falls.

- TODO: "If arm C does not beat arm B by at least ___ percentage points on the primary metric
  [and the interval of the difference excludes ___], the write-up says that TestivAI did not
  measurably help over a pixel comparison in this study."

**Know what this design can detect before choosing the margin.** With 24 tasks as the unit of
analysis, the interval on a difference between two arms will be wide: as a rough guide, around
plus or minus 15 to 20 percentage points, depending on how much tasks differ from each other. A true
difference of 5 to 10 points will most likely not be distinguishable from zero. Use the pilot to
estimate the spread between tasks, and state here what size of difference the full run could
detect: TODO

## 10. What the pilot may and may not change

- May: fix a task that is broken (all arms at 0% or 100% for a reason unrelated to the arms), fix
  the runner, set the budget.
- May not: tune prompts, arm instructions or tasks towards a result. Every change after the pilot
  is listed in `CHANGES_AFTER_PILOT.md`.
- Pilot runs are excluded from the final analysis: TODO (yes or no, decided now)

## 11. Known limits, to be stated in the write-up

- One agent and one model. The result may not carry over to others.
- The tasks were written by the maker of TestivAI, with an AI assistant, who know what TestivAI
  reports. The categories were fixed before any task was written and the scoring is independent of
  TestivAI, but the choice of bugs is not blind.
- The scorer measures DOM, computed styles and boxes. A defect that exists only inside an image's
  pixels (a wrong picture, a canvas drawing) cannot be scored this way and is not in the set. That
  is a class of bug where a pixel comparison is at its best, so its absence favours neither B nor
  C in the scoring, but it narrows what "visual bug" means here.
- A small static site. Real applications have dynamic content and more noise.
- TODO: anything else

## Deviations

None yet.
