# Study 2 results: does TestivAI help a coding agent more than a pixel comparison, on generated defects?

**Short answer, for the one model the study ran on (Claude Sonnet 5.5 in Claude Code 2.1.322):**

- **TestivAI did not measurably help over a pixel comparison, again.** On the 60 tasks with a defect,
  TestivAI's arm succeeded in 170 of 180 runs and the pixel comparison's in 166 of 180:
  - C − B was +2.2 points (95% interval −1.1 to +6.1);
  - its one-sided bound was −0.6 points, with p = 0.11;
  - H1 was not supported, and the preregistered kill line was reached.
- **The tasks were too easy to tell the two tools apart.** The pixel comparison alone solved 92% of
  the runs with a defect, so C − B could not exceed 7.8 points. The kill line's 10 points could not
  have been reached whatever TestivAI did. The pilot that set the difficulty ran on one site and
  measured 83%; across all six sites the full study measured 93%.
- **TestivAI used more tokens overall, but not everywhere.** Per task, C used 1.17 times B's tokens
  (95% interval 1.03 to 1.33). H2 is rejected after Holm's correction (p = 0.018, adjusted 0.036).
  - The extra came from the tasks without drift: 1.49× and 1.33×.
  - With drifted baselines (S3), C used fewer, at 0.81× (0.65× to 1.01×).
  - There B's runs took a median of 27 turns and 116 s of agent time, against C's 19 turns and 51 s.
  - The per-stratum numbers are description, not tests.
- **The decoys were no contest.** Neither arm changed the site in any of the 72 decoy runs.

The study was preregistered before any scored run ([PREREGISTRATION.md](PREREGISTRATION.md), tag
`study2-prereg-v1`). This result is published as it said, whichever way it fell.

**Who did this.** The study was designed and run by the maker of TestivAI, with an AI assistant
(Claude, in Claude Code), and it compares the maker's own tool. The scoring was built so that neither
tool decides anything (below). Every run, transcript and change is in this repository.

## Why a second study

Study 1 ([../RESULTS.md](../RESULTS.md)) found both visual tools near the ceiling. Its 24 tasks had one
hand-written defect each, written by TestivAI's maker. Study 2 aimed to fix both problems:

- **The defects are generated at random:** CSS declarations changed by seeded draws, on real sites.
- **The tasks are harder:** several defects at once, and baselines recorded on a machine that renders
  slightly differently.

## The design

> Does TestivAI help a coding agent fix visual regressions more than a plain pixel comparison?

**Arms.** As in study 1, one agent with one model, the same prompt and limits, and only the tooling
differs ([arms/](arms/)). There is no arm without a visual tool.

| arm | the agent has |
| --- | --- |
| B, pixel comparison | the site, Playwright's `toHaveScreenshot()` with approved baselines, and the diff images |
| C, TestivAI | the site, TestivAI's capture (witness 2.7.2), its MCP server (0.9.4) and `results.json` (DOM, styles and boxes beside the pixels) |

**Sites.** Six Start Bootstrap templates, drawn by a seed and served offline: agency, bare,
full-width-pics, heroic-features, shop-item and small-business. Each is a one-page site, checked at
desktop and phone width.

**Tasks.** 72 tasks on those sites, in four strata ([TASKS.md](TASKS.md)):

| stratum | tasks | the defect | the baselines |
| --- | --- | --- | --- |
| S1 | 20 | two random CSS mutations | clean |
| S2 | 20 | three random CSS mutations | clean |
| S3 | 20 | one random CSS mutation | drifted: recorded with full font hinting |
| S4, decoys | 12 | none | drifted |

- **How a mutation is drawn:** a declaration the site actually uses, changed by a rule for its class
  (colour, margin, width, font size, display and flex, and so on). Each site's class mix is dealt from
  a deck, so it is as even as the site allows.
- **Which mutations are kept (the validity filters):**
  - the change must measurably move or restyle a rendered element;
  - both arms' own comparators must flag it.
- **The difficulty:** these are the counts of the ladder's first rung. The tasks as first drafted
  were too easy, at 97% pooled success in the first pilot.
- **The prompt names nothing:** "The site looks different since the last change. Can you take a
  look and fix it?". The workspace has a single commit, so git history does not show the change.

**Scoring.** A hidden oracle measures the DOM, the computed styles and the element boxes of each view,
in a clean copy of the site ([PREREGISTRATION.md](PREREGISTRATION.md), section 5):

- **S1 to S3:** success means every property the mutations changed is back, nothing else changed, and
  nothing protected was touched. Any fix counts, not only reverting the line.
- **S4:** success means no file under the site changed.

No TestivAI verdict and no screenshot comparison decides anything, and the oracle is never in the
agent's workspace.

**Tests (preregistered).**

- **H1:** C's success is higher than B's over S1 to S3 (60 tasks), paired by task, with a bootstrap
  over tasks.
- **H2:** C and B differ in tokens per run (the per-task median, paired, on a log scale).
- **Correction:** Holm's procedure over the two, at 5% overall.
- **Kill line:** if C − B is under 10 points, or its one-sided interval reaches 0, the write-up says
  TestivAI did not measurably help.

## Results

432 runs: 72 tasks × 2 arms × 3 repeats, in a seeded random order. They ran on 2026-11-24 from 05:23
to 12:40 UTC, with 6.9 hours of run time. Every run used Claude Code 2.1.322 and the same model.
There were no errors and no retries.

The data is in [results/study2/sonnet/full-rung1/](../results/study2/sonnet/full-rung1/): one line per
run in `runs.jsonl`, every transcript and diff, and the generated
[summary](../results/study2/sonnet/full-rung1/summary.md).

| | B, pixel comparison | C, TestivAI |
| --- | --- | --- |
| **success, S1 to S3 (the primary tasks)** | **166/180 (92%)** | **170/180 (94%)** |
| S1, two mutations | 58/60 | 59/60 |
| S2, three mutations | 59/60 | 60/60 |
| S3, one mutation, drifted baseline | 49/60 | 51/60 |
| S4, decoys, drifted baseline | 36/36 | 36/36 |
| said "done" but had not succeeded | 2 | 1 |
| changed something that was not broken | 3 | 0 |
| median tokens per run | 260k | 338k |
| median turns per run | 17 | 16 |
| median agent time per run | 43 s | 40 s |
| cost, API-equivalent, 216 runs | $45.43 | $44.14 |

**H1: not supported.**

- **C − B over the 60 tasks:** +2.2 points (95% interval −1.1 to +6.1).
- **The one-sided bound is −0.6 points,** with bootstrap p = 0.114. Holm's procedure does not
  reject H1.
- **The kill line is reached:** TestivAI did not measurably help over a pixel comparison in study 2
  either.
- **Task by task,** C did better on 6 tasks and B on 3, by one or two runs of three each:

  | C did better | B did better |
  | --- | --- |
  | s2t07, s2t49, s2t59 (S3); s2t08, s2t50 (S1); s2t66 (S2) | s2t45, s2t68 (S3); s2t25 (S1) |

**H2: rejected.**

- **C used 1.17 times B's tokens per task** (95% interval 1.03 to 1.33). The bootstrap p is 0.018,
  0.036 after Holm.
- **The direction depends on the stratum.** This is description, not a test:

| stratum | median turns B / C | median agent seconds B / C | C's tokens over B's, per task |
| --- | --- | --- | --- |
| S1 | 13 / 15 | 33 / 36 | 1.49× (1.28× to 1.75×) |
| S2 | 17 / 17 | 41 / 39 | 1.33× (1.12× to 1.57×) |
| S3 | 27 / 19 | 116 / 51 | 0.81× (0.65× to 1.01×) |
| S4 | 12 / 13 | 33 / 30 | 0.91× (0.63× to 1.26×) |

On clean baselines, TestivAI's extra report costs tokens and buys nothing measurable. On drifted
baselines, Playwright's diff shows the drift everywhere, and B's agent spends longer working out what
is noise. TestivAI labels the drift, and C's agent gets there sooner. The preregistration (section 9)
expected this: S3 and S4 test a case TestivAI was built for. Even there, the success rates are close
(49 against 51 of 60).

**Partial credit in S2** (description): the mean share of mutations restored was 0.994 for B and 1.000
for C. Its known limit is that two mutations moving the same elements count as neither until both are
restored. It barely matters here, since almost every S2 run restored everything.

### How the runs failed

| how | stratum | B | C |
| --- | --- | --- | --- |
| changed nothing, and said it was not done | S3 | 9 | 9 |
| restored the defect, but also changed a clean value to make the drift go away | S3 | 2 | 0 |
| restored it differently, and changed something the screenshot did not show; said done | S1 | 1 | 0 |
| left part of it, and said done: its own visual test passed | S1 | 1 | 1 |
| left part of it, and said it was not done | S2 | 1 | 0 |

- **Most failures were in S3,** in both arms: 20 of 24. There the agent put the real change down to
  the drift and changed nothing. All 18 such runs said honestly that they had not fixed anything.
  - Three tasks account for 15 of them: s2t20 (0 of 6 runs succeeded), s2t68 (1 of 6) and s2t53
    (2 of 6).
  - In s2t20 the mutation narrowed the dropdown caret, a `::after` pseudo-element, by a couple of
    pixels. Every run in both arms took it for font drift.
- **The two arms' S3 difference is exactly two runs.** Both are B runs on s2t49.
  - They restored the heading's desktop size.
  - Then they took the drift's remaining difference on the phone for part of the defect, and changed
    the phone's clean `font-size` too. The oracle counts that as collateral damage.
  - C's three runs restored the same value, put the remainder down to drift, and stopped.
- **The three false "done" runs (2 in B, 1 in C) have one thing in common.** The arm's own visual test
  passed, but the oracle measured a difference that the comparison, at its tolerance, did not flag:
  - a navbar's background on the phone (C);
  - a toggler's line height (B);
  - a subheading's font family (B). Neither that font nor the one put in its place is installed
    offline, so both render as the same fallback.

### What TestivAI's evidence said under drift

These are observations from reading the transcripts, not rates. Both come from the shop-item site's two
S3 tasks (6 C runs), and both point at TestivAI 2.7.2's capture code (`collectElementMap`):

1. **A width change reads as "styles match".**
   - **The task:** in s2t68, `.row-cols-2 > *` went from `width: 50%` to `25%`, squeezing the phone
     view's product grid.
   - **What TestivAI said about the phone snapshot:** `styleCheck: "match"` with `noiseHint: true`,
     and the verdict "page grew 10 px … with an identical DOM … the same content is laid out taller
     (often fonts or rendering that differ between machines)".
   - **Why:** `width` is not among the computed styles TestivAI hashes, and TestivAI's own rules list
     sizes as something its style check does not cover. With a baseline that really had drifted, the
     wording pointed the agent at rendering.
   - **What the runs did:**
     - **C:** two of the 3 C runs read TestivAI's verdict on the phone snapshot and stopped there. The
       third never looked at the phone. None opened the phone's images, and all 3 changed nothing.
     - **B:** the one B run that succeeded opened the phone's diff images. The two that failed never
       looked at the phone.

     So the miss is also about where the agent looked, not only about what TestivAI said.
2. **Drift alone raised a style "mismatch".**
   - **What happened:** on the desktop view of both shop-item S3 tasks, TestivAI reported
     `ul.navbar-nav` restyled, "a real change, not noise". The mutation in s2t68 does not touch the
     desktop navbar.
   - **Why:** the list has `me-auto`, a margin that takes up whatever space is left in the row.
     Margins are among the hashed styles, and the browser reports them in pixels. When the drifted
     fonts change the brand's width, that margin changes too.
   - **What the runs did:** the agents checked it, found the box had moved 3 px, and set it aside.

Both are worth fixing in TestivAI, but this study was not built to measure them.

### Against the pilot that sized the study

| | pilot (one site, rung 1) | full study |
| --- | --- | --- |
| pooled success, S1 to S3 | 30/36 (83%) | 336/360 (93%) |
| per-task SD of C − B | 0.00 over 6 tasks | 0.15 over 60 tasks |

The preregistration's ladder moves to harder tasks only above 85% pooled success. The second pilot
measured 83% on its one site, so the tasks stayed at rung 1. Across all six sites they were easier.

The pilot's spread of 0 was a weak estimate (TASKS.md said so before the full study). The full study's
0.15 is still below the 0.2 that the preregistration's power table puts at 99% for a true 10-point
difference.

So the design could detect 10 points. The tasks simply left no room for them.

### The task generation

- **What the filters kept:** of 317 candidate mutations drawn, 124 changed an element's measurements
  and some pixels. Playwright's comparator flagged 120 of those and TestivAI's 122.
- **What the both-flag filter dropped:** 2 that only TestivAI's comparator saw (a colour and a
  border), and 2 that neither saw. Those 2 would most likely have favoured C, but they are 2 of 124.
- **The class mix is uneven,** because many classes do little on these sites:
  - no overflow mutation ever showed;
  - opacity and letter-spacing showed once each;
  - 120 colour candidates were rejected because they changed custom properties that no rendered
    element uses.

  The deck kept the mix as even as each site allowed, and the dead classes per site are recorded in
  `tasks.json`.

## What went wrong, and what was done about it

- **A shortcut flag counted `sort -u` as `--update-snapshots`.**
  - **What happened:** the rule read past the pipe in `npx playwright test … | sort -u`, so 16 B runs
    were flagged as updating snapshots. None did: no transcript has `--update-snapshots` or
    Playwright's `-u`, and no run tampered.
  - **The fix:** made test first, and the analysis re-reads the flags from the transcripts.
  - **Effect:** flags are description only, and study 1's summaries come out byte for byte the same.
- **Arm-blindness slipped once.** During the full study, the assistant meant to count only runs and
  errors. When the run stopped at 124, one log check showed the outcomes of runs 121 to 124 (2 per
  arm, all successes).
  - **What it touched:** this was after the preregistration, the task set and the analysis were
    frozen, and nothing was decided after it.
  - **Since then:** every log check filters outcome lines out.
- **The study ran in five stretches.**
  - **Why:** the session that ran it can keep a background task for at most 2 hours. The first
    launch was stopped by hand after 2 runs, to start it in a way that ran the full 2 hours.
  - **The restarts:** each restart reran only the run in progress: runs 3, 125, 246 and 356. They
    had recorded no result and started again from scratch.
  - **The code:** the code was the same in every stretch; only results were committed between them.
- **Isolation.**
  - **The check:** all 432 transcripts were searched for the benchmark's path, other runs'
    directories, credentials and email addresses. None was found.
  - **What the agents did reach outside their project:**
    - their own run directory;
    - the system's font configuration (`/etc/fonts`, `fc-list`), read while chasing the drift;
    - a disk search for a clean Bootstrap stylesheet (`find / -name "bootstrap*.css"`, in 9 runs),
      which found nothing.
  - **No downloads:** no run downloaded or installed anything.
- **Additions after the results, all description:**
  - the per-stratum token ratios;
  - the pilot's measures taken on the full study;
  - the comparator counts;
  - the headroom note;
  - the markdown summary itself, which the preregistration left to be built for the write-up.

  None changes H1, H2 or their numbers (Deviations, in the preregistration).

## Limits

- **Near the ceiling.** With B at 92%, the study could not show the 10-point difference it was built
  to detect. The +2.2 points are consistent with no difference and with a small one.
- **Generated defects are not real ones.** They are random CSS changes, not the regressions developers
  make. They are unbiased in a way that hand-written tasks are not, but less realistic.
- **The menu was written by TestivAI's maker.** That covers the mutation classes, the rules and the
  strata. The sites and tasks were drawn at random from it.
- **S3 and S4 favour TestivAI by design.** It is built to label drift. The difference there is
  reported per stratum, apart from the test, and it is still small in success.
- **Six sites from one vendor.** All are Start Bootstrap templates on Bootstrap 5.2.3, one page each,
  static, with no JavaScript-driven layout.
- **One model and one agent,** in a locked-down harness:
  - only Bash, Read, Edit and TestivAI's MCP tools;
  - a sandbox;
  - an instruction to end with a STATUS line.

  It is the same in every arm, but it is not everyday use.
- **The oracle can be stricter than any screenshot.** In one run it failed a font-family change that
  rendered the same, because the font is not installed offline.

## What this does and does not show

**It shows** that, for this agent, a plain screenshot comparison with diff images is enough to fix
nearly every random CSS defect on these sites, two or three at once included. TestivAI's DOM, style
and box evidence did not change the success rate measurably. It cost more tokens where the baselines
were clean, and fewer where they had drifted.

**It does not show** that TestivAI never helps. Two studies have now ended at the ceiling. A study that
could tell the tools apart would need tasks where B fails often:

- harder pages;
- defects hidden among real drift;
- longer sites with many views;
- a difficulty set across several sites, not one.

Efficiency is where the two tools differ today, so such a study should make it a primary outcome, as
H2 was here.

## Reproducing it

The machine needs Node 22, Claude Code 2.1.322, Chromium for Playwright and, on Linux, bubblewrap and
socat. Then:

```bash
npm ci && npm test && npm run test:runner
node study2/validate-tasks.mjs study2/tasks.json --arms    # every task, and each arm's own test
node runner/run.mjs probe                                   # isolation check, must say PASS
node runner/run.mjs start --study 2 --phase full
node study2/analyze.mjs results/study2/sonnet/full-rung1/runs.jsonl study2/tasks.json \
  --write --pilot results/study2/sonnet/pilot-rung1/calibration.json
```

The last command, on the committed `runs.jsonl` and transcripts, reproduces every number above and
writes the summary. Details are in [../RUNNING.md](../RUNNING.md), "Study 2".
