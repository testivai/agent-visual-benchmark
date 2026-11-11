# The three arms

Same agent, same model, same task prompt, same limits, same tools. The only differences are the files
in `arms/<arm>/files/` and one line of the instructions. This page puts them side by side.

## What every arm gets

- The app with the task's seed applied, in a fresh git repository with one commit ("Initial commit").
- The functional tests (`tests/functional.spec.ts`), Playwright 1.63.0 and its Chromium, installed.
- `CLAUDE.md` in the workspace, also passed to the agent with `--append-system-prompt-file`
  (`--bare` mode does not read `CLAUDE.md` by itself). The base text is
  [`base/CLAUDE.md`](base/CLAUDE.md).
- The task's prompt, word for word from `tasks/<id>/task.json`.
- Claude Code's tools in `--bare` mode: Bash, Read and Edit, allowed without asking. That is the
  whole built-in set in this mode (Claude Code 2.1.322 gives these three whatever `--tools` asks
  for); there is no Write, Glob, Grep, TodoWrite or Task tool, and Bash does what they would. Read
  shows images, so the agent can look at screenshots and diffs. Web tools are not available, and a
  run whose tool list includes one is an error. Reading or editing the benchmark's own directory is
  denied. Each run records the tool list Claude Code reported.
- The same limits: `runner.config.json` (turns, time, spend per run).

## What differs

| | A, blind | B, pixel | C, TestivAI |
| --- | --- | --- | --- |
| visual tests | none | `tests/visual.spec.ts`: `toHaveScreenshot()` per page | `tests/visual.spec.ts`: `witness()` per page |
| sizes captured | | 1280x800 and 390x844 | 1280x800 and 390x844 |
| baselines | | 12 PNGs in `tests/visual.spec.ts-snapshots/`, from the clean app | 12 in `.testivai/baselines/` (screenshot, DOM, element boxes and styles, metadata), from the clean app |
| tool settings | | Playwright's defaults (threshold 0.2, no pixel allowance) | TestivAI's defaults, except `autoOpen: false` so the report does not try to open a browser |
| MCP server | none | none | `@testivai/mcp` 0.9.4, rooted at the workspace |
| packages | `@playwright/test` 1.63.0 | `@playwright/test` 1.63.0 | adds `@testivai/witness-playwright` 2.1.3, `@testivai/witness` 2.7.2, `@testivai/mcp` 0.9.4 |
| instruction line | none | [`B/instructions-line.md`](B/instructions-line.md) | [`C/instructions-line.md`](C/instructions-line.md) |

The two instruction lines, in full:

> B: - `npx playwright test tests/visual.spec.ts` compares each page, at desktop and phone size, with approved screenshots; the differences are saved as images in `test-results/`.

> C: - `npx playwright test tests/visual.spec.ts` compares each page, at desktop and phone size, with approved baselines; results are in `visual-report/results.json` and the `testivai` tools.

Both are 24 words. A test (`runner/arms.test.mjs`) keeps them the same length and keeps every arm's
instructions free of bug-category words.

## Things a reader should know

- **C's baselines hold more than pixels.** A TestivAI baseline records the page's DOM, the boxes and
  computed styles of its elements, and how the capture went. An agent in arm C can read the clean
  page's values from them; an agent in arm B can only see them in a picture. That is the difference
  between the tools, so it is part of what is measured, not a leak. It matters most because the
  scorer is strict about restoring the design's values (see `PREREGISTRATION.md`, the lenient rate).
- **C's tools take context.** The MCP server's tool descriptions are added to every request in arm C,
  so its runs cost more tokens before any work starts. Cost is reported per arm.
- **Approving is possible in B, refused in C, and counts as tampering in both.** B can run
  `--update-snapshots`. In C, `approve_snapshot` and `approve_all` require a person, and the runs use
  `dontAsk` mode, so Claude Code denies them; `npx testivai approve` is a shell command and would
  work. Any change to a baseline, a test, a config or `node_modules` makes the run a failure
  (`runner/tamper.mjs`).
- **The capture sizes are a choice.** Both visual arms capture a phone size, so both can see the two
  defects that exist only under 720px (t05, t20). Capturing at desktop width only would make those
  two tasks invisible to both. Whichever is chosen, B and C must match (a test checks they do).
- **Baselines are recorded on the machine that runs the study**, once per arm, from the clean app
  (`runner/templates.mjs`). A second run on the clean app must then report no difference, or the
  runner refuses to continue.
