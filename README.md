# agent-visual-benchmark

A task set and hidden scoring for one question:

> Does a coding agent fix visual UI bugs more often when it can use a visual testing tool than when
> it cannot?

The study compares three arms of the same agent: blind (code and functional tests only), pixel
(Playwright's built-in screenshot comparison) and TestivAI. This repository holds the app, the 24
tasks and the hidden scorer (part 1), and the runner that puts an agent on each task under each arm,
scores what it leaves and analyses the results (part 2). The plan and the numbers to fix in advance
are in [PREREGISTRATION.md](PREREGISTRATION.md); the tasks are listed in [TASKS.md](TASKS.md); the arms
side by side in [arms/README.md](arms/README.md); how to run it in [RUNNING.md](RUNNING.md).

The result will be published whichever way it falls. Two rules keep it worth publishing:

1. **Scoring does not depend on the tools being compared.** A run is scored by Playwright assertions
   on the DOM, computed styles and element boxes. No TestivAI verdict and no screenshot comparison
   decides anything.
2. **The agent cannot see the answer.** Scorers and reference fixes live in `oracle/`, which is never
   copied into the workspace the agent gets.

## Layout

```
app/                 what every arm gets: a six-page static shop and its functional tests
tasks/<id>/          task.json (the prompt, type, category, pages) and seed.patch. Nothing else.
oracle/              HIDDEN from the agent
  <id>/score.spec.ts       passes only when the task is done correctly
  <id>/collateral.spec.ts  passes only when the rest of the site is unchanged
  <id>/reference.patch     one correct solution
  <id>/wrong.patch         a fix that only hides the symptom; the scorer must reject it
  <id>/accepted/*.patch    other correct solutions; the scorer must not reject them
  <id>/edits.mjs           what the patches are generated from
  <id>/notes.md            what the seed does, what "fixed" means, what a screenshot shows
  lib/                     how the site is measured and compared
  visibility.json          whether a screenshot shows each seed (measured)
harness/             npm run validate, throw-away workspaces, the spec runner
tools/               authoring: patches from edits, TASKS.md, the font and image builds
arms/                what differs between the arms: their files and one instruction line
runner/              builds each workspace, starts the agent, scores the result (npm run runner)
analysis/            npm run analyze: rates, paired comparison, summary.md, CSVs
results/<phase>/     the runs, transcripts and diffs, once a phase has run
runner.config.json   model, limits, isolation, seeds
BUDGET.md            the spend limit, set by the maintainer
CHANGES_AFTER_PILOT.md  every change made after seeing pilot scores
```

Task ids (`t01` to `t24`) say nothing about the task, and fix and decoy tasks share the same report
sentences, so neither an id nor a prompt gives the type away.

## Commands

```bash
npm install            # Playwright 1.63.0 (pinned), pixelmatch, pngjs
npx playwright install chromium   # once, if the browser is not installed

npm test               # the harness's, oracle library's, runner's and analysis's own tests
npm run test:runner    # the runner end to end with a fake agent (real workspaces and scoring, no model)
npm run validate       # every task, on three states; exits 1 if any task misbehaves
npm run validate -- --task t03,t07
npm run test:functional  # the app's functional suite on the clean app

node harness/inspect.mjs t03   # what a task's patches change, in measured terms
npm run visibility     # re-measure what screenshots show -> oracle/visibility.json
npm run author         # regenerate every patch from oracle/<id>/edits.mjs
node tools/tasks-table.mjs     # regenerate TASKS.md

npm run runner -- plan --phase pilot    # the pilot's runs, in order (free)
npm run runner -- check                 # preflight (free)
npm run analyze -- --phase pilot        # results/pilot/summary.md
```

The commands that start a real agent (`probe`, `dry-run`, `start`) and the order to use them in are
in [RUNNING.md](RUNNING.md).

### What `npm run validate` proves

For every task, on throw-away copies of the app:

| state | must hold |
| --- | --- |
| clean app + `seed.patch` | `score.spec.ts` **fails** (decoy: passes); `collateral.spec.ts` and the functional suite pass |
| + `reference.patch` | `score.spec.ts`, `collateral.spec.ts` and the functional suite pass |
| + each `accepted/*.patch` | the same as the reference |
| + `wrong.patch` | at least one of the two specs **fails** |

A spec that crashes, times out or runs no test is an error, never a "fail", so a broken scorer cannot
pass for a strict one. It also lints each task: the task directory holds only `task.json` and
`seed.patch`; the prompt names no selector, tag, file, CSS property or bug category; the seed adds no
hint word; no file under `app/` or `tasks/` mentions a visual testing tool. The harness's own tests
run it against a small bench with a scorer that cannot fail, a reference that does not fix and a wrong
fix that passes, and expect each to be named.

## How a run is scored

The scorer serves the workspace's `site/` directory with its own static server (it runs no code from
the workspace) and measures 23 views: each of the six pages at 1280x800 and 390x844, plus the states
a visitor can reach (menu open on a phone, order dialog open, contact form errors, contact form
sent).

For every element it records (`oracle/lib/capture.mjs`):

- its box, in page coordinates
- how it is painted: colours, borders, radius, shadow, font, text alignment and transform
- its own text, and the box that text occupies (which catches a failed font and text that spills)
- the fraction of it that no ancestor clips
- at how many of five sample points it is what a click would land on (which catches stacking order)
- for images, the natural size; for the page, its scroll size and whether its fonts loaded

**Outcomes, not mechanisms.** Padding, margin, `z-index`, `display` and the like are not recorded,
so two ways to the same rendering measure the same. Numbers are equal within half a pixel.

Nothing is stored as a golden file. The clean app, the seeded app and each known solution are
measured on the scoring machine and cached in `.cache/`, so a different machine's fonts cannot cause
a false failure. From those measurements each task gets its scope (`oracle/lib/compare.mjs`):

- **fix**: every field the seed changed must be back at its clean value (`score`), and every field
  it did not change must still be at its clean value (`collateral`). Each fix task also has a few
  hand-written assertions that say in plain terms what was broken.
- **change**: hand-written assertions check that the change was made (`score`). Elements that a
  known solution restyles are free; everything else must still measure as the clean app
  (`collateral`).
- **decoy**: no file under `site/` differs from the seeded app (`score`).

A run succeeds when `score` and `collateral` both pass.

### What the scorer accepts, and what it cannot see

Read this before trusting a number.

- **It is strict about the design.** A fix must restore the values the page had. A different colour
  that also looks fine is "not fixed". The seeds were chosen so that the right value can be worked
  out from the code (a token, a sibling rule, the markup of another page), and the pixel and TestivAI
  arms can also read it from the baseline.
- **It does not judge code quality.** A hack that restores the rendering exactly scores as fixed.
  The exception is content the seed inserted: stray elements are counted, shown or hidden, so they
  must be removed (see the notes of t06 and t09).
- **It cannot see** pseudo-elements, hover and focus states, the pixels inside an image or a canvas,
  or viewport sizes other than the two it measures. No task depends on those.
- **Change tasks are the least certain.** There are many correct ways to make a change. Each one
  has at least one accepted alternative that the scorer is proven not to reject, but an unusual
  correct solution could still be scored as collateral damage. When a run fails only on collateral
  in a change task, read the diff before counting it.

## How a run works (part 2)

1. **Workspace.** A fresh directory with a name that says nothing (`/tmp/avb-…/project`): the clean
   app with the task's seed, the arm's files and baselines, `CLAUDE.md`, one git commit, and the
   arm's packages. `oracle/`, `tasks/`, `TASKS.md`, other arms' files and anything mentioning the
   benchmark are refused before the agent starts (`runner/workspace.mjs`).
2. **Agent.** Claude Code in print mode: `--bare` (no hooks, plugins, memory or user settings), an
   empty config directory, the pinned model, `dontAsk` permissions with an explicit allow list, web
   tools denied, the benchmark directory denied, Bash in the sandbox, turn, time and spend limits.
   Only `ANTHROPIC_API_KEY` and a few named variables reach it (`runner/claude.mjs`).
3. **Score.** The workspace's `site/` is copied into a clean copy of the app and scored there by the
   oracle and the functional suite. Changes to tests, baselines, tool configuration or packages are
   tampering and make the run a failure (`runner/tamper.mjs`). The transcript and the diff are kept,
   with credentials removed.
4. **Record.** One line per attempt in `results/<phase>/runs.jsonl`. A run that ends in an error is
   retried once; a run that hits a limit is scored as it stands. Runs go in an order shuffled from a
   recorded seed, so drift in the model service over time does not line up with one arm.

A run succeeds when `score` and `collateral` pass and nothing was tampered with. It is a false
"done" when the agent ends with `STATUS: DONE` and the run did not succeed.

The runner's own logic is tested with a fake agent (`runner/fake-claude.mjs`, same arguments and
output format as `claude -p`): a reference fix scores success, a wrong fix failure, doing nothing
fails a fix task and passes a decoy, a crash is an error retried once, editing a baseline is
tampering, a hang is stopped at the time limit (`runner/e2e/run.test.mjs`).

## Adding or changing a task

1. Write `tasks/<id>/task.json` and `oracle/<id>/edits.mjs` (the seed, the reference, a wrong fix,
   and accepted alternatives), then `npm run author`. Patches are never typed by hand.
2. Write `oracle/<id>/score.spec.ts`, `collateral.spec.ts` and `notes.md`.
3. `node harness/inspect.mjs <id>` shows what the patches change. `npm run validate -- --task <id>`
   must pass.
4. `npm run visibility`, bring `notes.md` in line with it, `node tools/tasks-table.mjs`, `npm test`.

If the app itself changes, run `npm run author` and all of the above again: every measurement is
keyed to the app's files.

## Licence

MIT, see [LICENSE](LICENSE). The app is grown from
[testivai-example](https://github.com/testivai/testivai-example). The web font is Figtree (SIL Open
Font License 1.1, `app/site/fonts/OFL.txt`), renamed "Acme Sans" in the file.
