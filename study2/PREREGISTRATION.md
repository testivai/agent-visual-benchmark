# Study 2: preregistration (draft)

**Status: draft.** The five design decisions below were made by the maintainer on 2026-11-18. Every
item still marked **Proposed** waits for the maintainer's yes or change. When all are settled, this file is frozen and tagged (`study2-prereg-v1`) before the first
pilot run. The rules of study 1 carry over: the pilot may calibrate difficulty and find broken tasks,
never choose anything after looking at which arm is ahead, and later changes go in a dated Deviations
section.

## Decided by the maintainer (2026-11-18)

1. **Task source:** random CSS mutations on third-party open-source sites (section 4), not hand-picked
   regressions.
2. **Arms:** the pixel comparison (B) and TestivAI (C) only.
3. **A second test:** token use (H2), two-sided, with Holm's correction for the two tests (section 6).
4. **Model:** Claude Sonnet 5.5 only.
5. **Size:** 72 tasks × 2 arms × 3 repeats = 432 runs, raised by the power rule of section 6 if the
   pilot calls for it.

## 1. Why a second study

Study 1 found no measurable difference between TestivAI and a plain pixel comparison: both solved
almost every task (`RESULTS.md`). Its tasks had one defect each, on a small site, written by TestivAI's
maker, and the pixel comparison was already enough. That leaves the question open for conditions where
a pixel comparison plausibly falls short:

- several defects at once;
- defects on longer, real-world pages;
- screenshots that differ for reasons that are not in the code (rendering drift between machines),
  with or without a real defect underneath.

Study 2 asks whether TestivAI helps there, with tasks no one chose by hand.

## 2. Question

Does a coding agent fix visual regressions more often with TestivAI than with a pixel comparison, when
the regressions are generated at random on real third-party sites and include several defects at once
and rendering noise?

## 3. Arms

- **Decided:** the same two arms as study 1, with the same tools, versions and instruction lines:
  - B: Playwright `toHaveScreenshot()` and its diff images;
  - C: TestivAI capture, MCP server and `results.json`.
- **Decided:** the no-tool arm A is dropped. Study 1 settled that having a visual tool helps; A would
  cost a third of the runs and does not bear on the question.

## 4. Tasks

**Sites (Proposed).**

- **Pool:** the Start Bootstrap templates published on npm (`startbootstrap-*`, MIT licence, 39
  packages on 2026-11-17).
- **Eligibility:** a built page in the package; not an admin dashboard; renders offline once its
  remote fonts and scripts are removed. Remote resources are stripped the same way for every site,
  and both arms see the same files.
- **Selection:** 6 sites drawn at random from the eligible ones, before any task is generated. The
  candidates are the 39 names in `study2/sites/candidates.json` (taken 2026-11-18). They are tried in
  the order given by seed **20261118** (`selectionOrder` in `study2/sites.mjs`), and the first six
  eligible are kept. Each is pinned to the version and integrity hash it had when drawn.
- **Proposed:** mutations are drawn only from CSS rules that match at least one element in a captured
  view. Most rules of a compiled Bootstrap stylesheet match nothing on the page.

**Mutations (Proposed).**

- **What a mutation is:** one change to one declaration in the site's own CSS:
  - a rule chosen at random from the site's stylesheets;
  - a property class chosen at random from a published list: colour, background, font size,
    font weight, letter spacing, line height, margin, padding, width, display and flex, position
    and z-index, border, opacity, overflow, text transform;
  - a new value from a fixed rule per class (for example: a length scaled by 0.5 or 1.5, a colour
    rotated in hue, a keyword swapped for another valid one).
- **Validity filters:** a mutation is kept only if it changes at least one measured property of a
  rendered element in a captured view, and at least one pixel of a captured screenshot. Otherwise
  another is drawn. These filters look only at the page, never at either tool's verdict.
- **Who chooses:** the RNG chooses everything, with recorded seeds. No person picks, reviews or
  discards an individual task before the runs, except by these filters, which run as code.

**Strata (Proposed), 72 tasks:**

| stratum | what the agent starts from | tasks |
| --- | --- | --- |
| S1, one defect | one mutation | 20 |
| S2, several defects | two or three mutations on different elements | 20 |
| S3, defect and drift | one mutation, and baselines recorded under a different rendering setting | 20 |
| S4, drift only (decoy) | no mutation, baselines recorded under a different rendering setting | 12 |

**Rendering drift (Proposed).** Baselines recorded with one fixed Chromium setting that changes
anti-aliasing or hinting but no CSS. The exact setting is chosen in the pilot as the first, in a
fixed list, that makes every page differ in pixels while the DOM and computed styles stay identical.
B and C get the same drifted baselines.

**Prompt (Proposed).** Every task gets the same prompt, which names no category: "The site looks
different since the last change. Can you take a look and fix it?"

**Validation (Proposed).** Every task must pass, as code, before the freeze, like study 1's
`npm run validate`:

- the seeded state fails the oracle;
- reverting the seed passes it;
- the clean site passes the collateral check;
- each decoy's pages differ from their baselines in pixels but not in DOM or styles.

## 5. Scoring

Decided by the oracle of study 1, generalised. No hand-written test per task is needed, since the
oracle measures what the seed changed.

- **S1 to S3, Proposed:** success means:
  - every property the mutations changed is back as it was (`checkRestored`);
  - nothing else changed (`checkCollateral`);
  - nothing protected was changed (tampering, as in study 1).
- **S4 (decoy):** success means no file under the site changed.
- **Proposed partial credit, for S2:** the share of the mutations restored, reported beside the strict
  rate.

## 6. Outcomes and analysis

**Primary (Proposed).**

- **What is compared:** success of C against B over S1 to S3 (60 tasks), paired by task.
- **Interval:** a percentile bootstrap over tasks (10,000 resamples, seed 1).
- **H1:** C is higher than B. It is supported if the one-sided 95% lower bound lies above 0.
- **Kill line:** if C − B is under 10 points, or its one-sided interval reaches 0, the write-up says
  that TestivAI did not measurably help over a pixel comparison in study 2 either.

**Second test (Decided).**

- **H2:** C and B differ in tokens per run on S1 to S3: the per-task median, on a log scale, paired.
- **Direction:** two-sided, since study 1 found C using about a third more tokens.
- **Correction:** with two tests, Holm's correction at 5% overall.

**Description only.**

- each stratum on its own, and the decoys;
- turns, agent time and cost;
- false "done";
- partial credit in S2;
- the tasks where B beat C, listed as prominently as the reverse.

**What the design can detect (Proposed).**

- **The deciding quantity is the per-task spread of C − B,** which the pilot measures. With 60 tasks:

  | per-task SD of C − B | one-sided margin | power for a true 10-point difference |
  | --- | --- | --- |
  | 0.2 | 4 points | 99% |
  | 0.3 | 6 points | 83% |
  | 0.4 | 9 points | 61% |

- **If the pilot's spread implies less than 80% power,** the task count is raised before the freeze,
  by a rule fixed here: add tasks to S1 to S3 equally until the estimate reaches 80%, up to 120
  tasks.

## 7. The pilot and difficulty calibration

**Proposed:** one site, 8 tasks (2 per stratum), B and C, 3 repeats each: 48 runs.

- **The calibration is arm-blind.** A script reports only the pooled success of B and C together on S1
  to S3.
- **If the pooled success is above 85%,** tasks get harder by a fixed ladder, one rung at a time, and
  the pilot runs again:
  1. two mutations per S1 task, three in S2;
  2. smaller value changes (scale 0.8 or 1.2);
  3. mutations only on elements below the first screen.
- **If it is below 40%,** the ladder goes the other way.
- **The pilot's per-arm results** are not computed until the study is frozen.
- **The pilot also measures** cost per run, and the per-task spread for section 6.

## 8. Runs

- **Decided:** Claude Sonnet 5.5 in Claude Code 2.1.322, the locked-down harness and isolation of
  study 1 unchanged. The probe must pass before the pilot and before the full run.
- **Size:** 72 tasks × 2 arms × 3 repeats = 432 runs, in a seeded random order. At study 1's pace,
  that is about 6 to 8 hours on the subscription.
- **Errors:** retried once; double errors excluded and listed, with a flag above 5%.
- **Decided:** Opus 5.5 is not run.

## 9. Known limits, to be stated in the write-up

- **Generated defects are not real ones.** They are CSS changes at random, not the regressions
  developers make. They are unbiased in a way hand-written tasks are not, but less realistic.
- **The mutation operators and the strata were designed by TestivAI's maker.** The sites and the
  individual tasks are chosen at random; the menu they are drawn from is not.
- **S3 and S4 test a case TestivAI was built for.** It labels pixel differences with identical DOM and
  styles as likely render noise. A difference there is expected by design and is reported per stratum,
  apart from S1 and S2.
- **One model and one agent.**
- **Static sites only:** no dynamic content, no JavaScript-driven layout.

## 10. What has to be built

None of this is built yet. The order:

1. **Site import:** fetch, strip remote resources, check that it renders offline.
2. **Mutation generator and validity filters,** with tests.
3. **Views per site, and the generalised oracle:** restore and collateral without hand-written tests.
4. **Drifted baselines** for B and C, with the setting search.
5. **Per-task validation,** as code.
6. **The calibration script,** pooled only.
7. **Analysis by stratum,** H2, and partial credit.

Each step is test first. The probe and the isolation stay as they are.

## Deviations

None yet.
