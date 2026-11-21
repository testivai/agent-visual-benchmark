# Results: does a visual testing tool help a coding agent fix UI bugs?

**Short answer, for the one model the full study ran on (Claude Sonnet 5.5 in Claude Code):**

- **TestivAI did not measurably help over a plain pixel comparison.** Both visual tools solved almost
  every task: TestivAI 119 of 120 runs, Playwright's screenshot comparison 118 of 120. The
  preregistered test failed and the preregistered kill line was reached.
- **Having a visual tool at all helped a great deal.** Without one, the agent succeeded in 100 of 120
  runs, and its failures were almost all the same mistake: changing things that were never broken.
- **TestivAI cost more.** Its runs used about a third more tokens than the pixel comparison's
  (median 119k against 89k), for the same success.

The study was preregistered before any scored run ([PREREGISTRATION.md](PREREGISTRATION.md)), and this
result is published as the preregistration said it would be, whichever way it fell.

**Who did this.** The study was designed and run by the maker of TestivAI, with an AI assistant
(Claude, in Claude Code). It compares the maker's own tool. The scoring was built so that neither
tool decides anything (below), and every run, transcript and change is in this repository.

## The question and the design

> Does a coding agent fix visual UI bugs more often when it can use a visual testing tool than when
> it cannot?

**Arms.** One agent, one model, the same task prompts and limits; only the tooling differs
([arms/README.md](arms/README.md)):

| arm | the agent has |
| --- | --- |
| A, no visual tool | the app's code and its functional tests |
| B, pixel comparison | A, plus Playwright's `toHaveScreenshot()` with approved baselines, and the diff images |
| C, TestivAI | A, plus TestivAI's capture, its MCP server and `results.json` (DOM, styles and boxes beside the pixels) |

**Tasks.** 24 tasks on a six-page static shop ([TASKS.md](TASKS.md)):

- 14 fix tasks, two per category: stacking order, style-only, a breakpoint, missing or duplicated
  content, layout shift, a failed web font, overflow or clipping;
- 6 change tasks ("centre the team cards");
- 4 decoys, where the screenshots differ but nothing is wrong.

Each prompt reads like a user's report ("the site looks different since the last change") and names
no bug category.

**Scoring.** A hidden oracle decides each run with Playwright assertions on the DOM, computed styles
and element boxes, in a clean copy of the app ([README.md](README.md#how-a-run-is-scored)):

- **Fix and change tasks:** success means the task's tests pass and nothing else on the site changed.
- **Decoys:** success means no file was changed.
- **Tampering:** changing a baseline, a test, a config or an installed package makes the run a failure.

No TestivAI verdict and no screenshot comparison decides anything, and the oracle is never in the
agent's workspace.

**Primary test (preregistered).**

- **What is compared:** success of C against B over the 20 fix and change tasks, paired by task.
- **H1:** C is higher than B. It is supported only if the one-sided 95% bootstrap interval lies above 0.
- **Kill line:** if C − B is under 10 points, or that interval reaches 0, the write-up says TestivAI
  did not measurably help over a pixel comparison.
- **What is not part of the test:** decoys are reported apart, and the other comparisons are
  description only.

## Results of the full study

360 runs: 24 tasks × 3 arms × 5 repeats, in a seeded random order. They used Claude Sonnet 5.5 through
Claude Code 2.1.322, on 2026-11-15, and took 4.5 hours. There were no errors and no retries. Data:
[results/sonnet/full/](results/sonnet/full/) (one line per run in `runs.jsonl`, every transcript and
diff, and the generated [summary](results/sonnet/full/summary.md)).

| | A, no visual tool | B, pixel comparison | C, TestivAI |
| --- | --- | --- | --- |
| success, all 24 tasks | 100/120 (83%) | 118/120 (98%) | 119/120 (99%) |
| fix tasks | 59/70 | 70/70 | 70/70 |
| change tasks | 29/30 | 28/30 | 29/30 |
| decoys (nothing to fix) | 12/20 | 20/20 | 20/20 |
| said "done" but had not succeeded | 19 | 2 | 1 |
| median tokens per run | 95k | 89k | 119k |
| median agent time per run | 23 s | 31 s | 36 s |
| cost, API-equivalent, all 120 runs | $10.91 | $10.76 | $11.71 |

**Primary test: not supported.**

- **C − B:** +1 point over the 20 fix and change tasks (95% interval 0 to +3).
- **The one-sided interval reaches 0,** so H1 is not supported.
- **The kill line is reached:** in this study, TestivAI did not measurably help over a pixel
  comparison.
- **Where the one point comes from:** a single task, t07 (a requested change). One arm B run updated
  the approved screenshots to make its test pass, which counts as tampering.
- **No task where B beat C.**

**The other comparisons (description, not tests).**

| comparison, fix and change tasks | mean difference | 95% interval |
| --- | --- | --- |
| C − A | +11 points | +2 to +23 |
| B − A | +10 points | 0 to +23 |

On the four decoys, both visual arms were 40 points above A (20/20 against 12/20).

**Why the no-tool arm failed.** Of its 20 failures:

| what happened | runs |
| --- | --- |
| a decoy, where it "fixed" a site that had nothing wrong | 8 |
| it changed other parts of the page as well (in 10 of these 11 it had done what was asked) | 11 |
| it could not find or fix the defect (and said so) | 1 |

In 19 of the 20 it said it was done. Without a baseline, the agent cannot tell the intended design from
a defect, so it tidies up things that were deliberate. Both visual tools give it that baseline, and
with either one it solved every fix task.

**The lenient rate.** It counts a fix as a success when the symptom is gone, even if the original values
are not restored. It equals the strict rate in every arm; a note in the preregistration explains why
it was expected to be close.

## Pilots on three models

Before the full study, each model ran a 54-run pilot on 6 of the tasks. Pilots are not part of the
analysis (preregistered), but they show the same pattern on every model:

| pilot, 54 runs | A | B | C |
| --- | --- | --- | --- |
| Claude Sonnet 5.5 | 10/18 | 18/18 | 18/18 |
| Claude Opus 5.5 | 16/18 | 18/18 | 18/18 |
| DeepSeek-V4.1-Flash (run again after the isolation fix) | 17/18 | 17/18 | 18/18 |

The Opus and DeepSeek full studies were not run. They were postponed before the Sonnet result was known,
for time (about 12 and 38 hours) and DeepSeek's cost. After the Sonnet result, they were closed out:
both pilots showed the same ceiling, so a full run would most likely repeat the null (see the
preregistration's Deviations). The study's result rests on Sonnet 5.5 alone.

## What went wrong, and what was done about it

Everything below is in the repository with dates. [CHANGES_AFTER_PILOT.md](CHANGES_AFTER_PILOT.md) lists
every change made after a pilot score was seen. None touched a prompt, an arm's instructions, a task,
the oracle or the scoring.

- **An isolation breach in the pilots.** The agent's sandbox closed only the directory that held the
  benchmark, and the Read tool was allowed everywhere. In the first DeepSeek pilot, 9 runs found and
  used leftover copies of the clean app in `/tmp`, from a failed template build during development.
  Two successes and seven decoy failures came from the leak. Opus saw two folder names and opened
  nothing; Sonnet never looked.
  - **The fix:** the home and temporary directories are closed to every tool, Read and Edit work only
    in the run's own directory, and runs moved out of `/tmp`. A probe that plants secrets checks every
    route on each model before its full study.
  - **The re-run:** the DeepSeek pilot was run again under the fix; the first is kept apart.
  - Full account: [docs/pilot-isolation-breach.md](docs/pilot-isolation-breach.md).
- **The benchmark's name in `PATH`.** Starting the runner with `npm run` put the benchmark's directory
  on the agent's `PATH`. Four runs of the DeepSeek re-run saw the name; none could read the directory.
  Fixed before the full study.
- **An email address in a transcript.** One agent searched the npm registry, and the results held
  package maintainers' addresses. Transcripts are now scrubbed of email addresses and logins, and all
  results were scrubbed again; the analyses came out byte for byte the same.
- **Reading transcripts.** Some agents left a background task running. Claude Code then woke them
  again after their answer, and the first parser read only the last reply. Turns, agent time and the
  "done" claim are now read from every reply, and the analysis re-reads them from the saved
  transcripts.
- **Claude Code updates.** The container came back twice with a newer Claude Code. The study kept
  2.1.322 in its own install, and every run records the version it ran.

The full study ran entirely under the fixed isolation. A check of all 360 transcripts found no path
outside each run's own directory, no credentials and no email addresses.

## Limits

- **One model, one agent.** The full study ran Sonnet 5.5 in Claude Code. Other models and agents
  may differ, though the pilots on Opus and DeepSeek showed the same ceiling.
- **The tasks are easy for a visual tool.** Each has a single defect on a small static site, and both
  visual arms solved nearly everything. The study cannot tell the two tools apart on harder problems,
  because it has none: several defects at once, long or dynamic pages, defects that show only in some
  states.
- **The tasks were written by TestivAI's maker.** The categories were fixed before any task was
  written and scoring is independent of TestivAI, but the choice of defects is not blind.
- **The scorer measures DOM, computed styles and boxes.** A defect that exists only in an image's
  pixels cannot be scored and is not in the set.
- **A locked-down harness.** Only Bash, Read and Edit; a sandbox; no memory, plugins or skills; an
  instruction to end with a STATUS line. It is the same in every arm, but it is not everyday use.
- **The npm registry stayed reachable** (the frozen configuration allows it). No run installed a
  package.

## What this does and does not show

It shows that, for this agent on single-defect tasks like these, a plain screenshot comparison with
diff images already gives it what it needs: both tools solved every fix task. TestivAI's extra
information (the DOM, computed styles and element boxes of the approved baseline) did not change the
outcome, and it cost more tokens.

It does not show that TestivAI never helps an agent. A study that could show that would need tasks
where a pixel comparison is not enough:

- real visual regressions taken from projects' history, chosen by someone without a stake in the
  result;
- harder pages, and several defects at once;
- decoys made of genuine rendering noise.

It should also measure efficiency (tokens, turns, time) as a primary outcome, since that is where the
two tools differ today. It would need its own preregistration.

## Reproducing it

The machine needs Node 22, Claude Code 2.1.322, Chromium for Playwright and, on Linux, bubblewrap and
socat. Then:

```bash
npm ci && npm test && npm run test:runner && npm run validate
npm run runner -- probe --model sonnet          # isolation check, must say PASS
npm run runner -- dry-run --phase full --model sonnet
npm run runner -- start --phase full --model sonnet
npm run analyze -- --phase full --model sonnet  # writes results/sonnet/full/summary.md
```

`npm run analyze` on the committed `runs.jsonl` and transcripts reproduces every number above. Details
are in [RUNNING.md](RUNNING.md).
