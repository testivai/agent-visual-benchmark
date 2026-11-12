# Running the study

How to run the dry runs and the pilots (and later the full study). Every step that spends money or
plan usage says so. Nothing here starts a run by itself.

## The models

`runner.config.json` lists them; every command takes `--model <id>` (default: the primary model).

| id | model | login | budget (`BUDGET.md`) |
| --- | --- | --- | --- |
| `sonnet` (primary) | `claude-sonnet-5-5` | the machine's Claude login (the maintainer's subscription) | subscription |
| `opus` | `claude-opus-5-5` | the same | subscription |
| `deepseek` | `deepseek-flash` (DeepSeek-V4.1-Flash) | DeepSeek's Anthropic-compatible API: `DEEPSEEK_API_KEY`, or a network proxy that holds the key | $20 |

Each model is a study of its own: same tasks, arms and scoring, results in `results/<model>/<phase>/`,
analysed on its own. Models are never pooled.

## 1. What the machine needs

- Node 22.12 or later, and git.
- Claude Code at the version pinned in `runner.config.json` (`agent.claudeCodeVersion`):
  `npm install -g @anthropic-ai/claude-code@2.1.322`. The runner refuses another version.
- Chromium for Playwright 1.63: `npx playwright install chromium`.
- For the sandbox (`"isolation": "sandbox"`, the default): on Linux, `bubblewrap` and `socat`
  (`sudo apt-get install bubblewrap socat`); on macOS nothing extra.
- For the subscription models: Claude Code logged in (`claude auth status`). Runs use that login and
  count against the plan's usage limits.
- For DeepSeek: `DEEPSEEK_API_KEY`, or a network proxy that adds the key to requests to
  `api.deepseek.com` (as in the cloud session the study was run in).
- Network access to the model's API and, once, to the npm registry.

How every run is locked down (the same for all three models) is in `README.md`, "How a run works",
and what was checked in `docs/phase0-findings.md`.

## 2. Freeze the setup

1. `npm ci && npm test && npm run test:runner && npm run validate`. All green.
2. `PREREGISTRATION.md` filled in, committed and tagged (`git tag prereg-v1`), before any dry run.
3. The plan (which tasks, which order) follows from the config and its seeds:
   `npm run runner -- plan --phase pilot`.

## 3. Check, at no cost

```bash
npm run runner -- check --model sonnet     # version, login, Chromium, sandbox tools
npm run runner -- prepare                  # installs each arm's packages and records its baselines
```

## 4. Probe and image check (cents)

```bash
npm run runner -- probe --model sonnet          # one short run in a throw-away workspace
npm run runner -- image-check --model deepseek  # can the model see a picture through Claude Code?
```

The probe asks the agent to run five commands and prints what each returned next to what it should:
the functional tests pass, `https://example.com` is blocked, the npm registry is reachable, the
benchmark's answer files cannot be read, and a server started and queried in one command answers.
The image check asks the agent to read a colour and a number that are only in a picture. A model that
fails it is not compared (arm B gives the agent pictures). Results go to `results/probe/`.

On Linux, the sandbox gives each command its own `localhost`: a server started in one Bash call
cannot be reached from the next. Playwright's own `webServer` starts in the same command as the
tests, so the test suites work. This is the same in every arm.

## 5. The dry run (one real run per model)

```bash
npm run runner -- dry-run --phase pilot --model sonnet
```

Runs the first arm C run of the plan, scores it, records it in `results/<model>/pilot/dry-run.jsonl`
(not in the study's runs) and prints the estimate for the pilot and the projection for the full study.
For a subscription model the estimate is "API-equivalent": nothing is billed, but it shows how much
of the plan's usage a run takes.

## 6. The pilots, one model at a time

```bash
npm run runner -- start --phase pilot --model sonnet --push-every 6
npm run runner -- status --phase pilot --model sonnet
npm run analyze -- --phase pilot --model sonnet       # results/sonnet/pilot/summary.md and csv/
```

- `start` checks the budget (`BUDGET.md`): a model with a dollar budget stops when the estimate is
  over it unless given `--confirm`; a subscription model needs only its dry run.
- The 54 runs go one at a time in the seeded order and can be stopped and started again: finished
  runs are not repeated. A run interrupted by stopping the runner starts again from scratch.
- A run that ends in an error (the agent crashed, the API failed, the startup report showed a tool,
  plugin, model or server it must not have) is retried once; both attempts stay in `runs.jsonl`.
- A run cut off by a usage limit is recorded, the runner waits until the limit resets (or 15 minutes,
  doubling to 2 hours), and runs it again; this does not use up the retry.
- `--push-every 6` commits and pushes the results every 6 finished runs, with CI skipped
  (`AVB_COMMIT_TRAILER` is added to each commit message), so a long run that loses its machine loses
  at most the run in progress.

After each pilot, read `results/<model>/pilot/summary.md`: the cost per run and the projection, the
tasks every arm passed or every arm failed, and the shortcut signs. Read a sample of transcripts too.
Anything changed before a full run goes in `CHANGES_AFTER_PILOT.md`.

## What is written where

```
results/<model>/<phase>/
  plan.json           the runs and their order (written at the first start; a changed plan is refused)
  runs.jsonl          one line per attempt, never edited
  transcripts/        the agent's stream-json output per attempt, credentials removed
  diffs/              the agent's change per attempt, as a patch against the starting commit
  dry-run.jsonl, dry-run/
  summary.md, csv/    from npm run analyze
results/probe/        probe and image-check transcripts, image-check.jsonl
```

Credentials are removed from every transcript, diff and error before it is written (any value of
`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` or `DEEPSEEK_API_KEY`, and
anything shaped like an Anthropic key). Read through the results before publishing them anyway.
