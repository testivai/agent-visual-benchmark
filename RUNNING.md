# Running the study

How to run the pilot (and later the full study) on your own machine, with your own API key. Every
step that spends money says so. Nothing here starts a run by itself.

## 1. What the machine needs

- Node 22.12 or later, and git.
- Claude Code at the version pinned in `runner.config.json` (`agent.claudeCodeVersion`):
  `npm install -g @anthropic-ai/claude-code@2.1.322`. The runner refuses to start with another
  version.
- Chromium for Playwright 1.63: `npx playwright install chromium`.
- For the sandbox (`"isolation": "sandbox"`, the default): on Linux, `bubblewrap` and `socat`
  (`sudo apt-get install bubblewrap socat`); on macOS nothing extra. Windows is not supported.
- An Anthropic API key in `ANTHROPIC_API_KEY`. Runs use only this key, never a logged-in
  subscription: each run gets an empty Claude Code config directory and starts in `--bare` mode.
  Use a key made for this study, with a spend limit set in the Console.
- Network access to the API and to the npm registry (once, to install each arm's packages).

## 2. Freeze the setup

1. `npm ci && npm test && npm run validate`. All green.
2. Decide the settings in `runner.config.json`: the model, effort, turn and time limits, spend cap
   per run, capture sizes (see `arms/README.md`). The committed values are a starting point, not a
   decision.
3. Fill in `PREREGISTRATION.md`, commit, and tag the commit (`git tag prereg-v1`). The plan
   (which tasks, which order) follows from the config and its seeds: `npm run runner -- plan --phase pilot`.

## 3. Check, at no cost

```bash
npm run runner -- check          # Claude Code version, API key, Chromium, sandbox tools
npm run runner -- prepare        # installs each arm's packages and records its baselines (a few minutes)
```

`prepare` refuses to finish if a tool reports a difference on the clean app against its own fresh
baselines.

## 4. Probe the isolation (a few cents)

```bash
npm run runner -- probe
```

One short real run in a throw-away workspace, asking the agent to run five commands. It prints what
each command returned next to what it should return:

1. the functional tests pass (a server and a browser can run inside the sandbox);
2. `https://example.com` is blocked;
3. the npm registry is reachable;
4. the benchmark directory cannot be listed;
5. a server started and queried in one command answers.

Do not go on until all five are as expected. On Linux, the sandbox gives each command its own
`localhost`: a server started in one Bash call cannot be reached from the next. Playwright's own
`webServer` starts in the same command as the tests, so the test suites work; an agent that starts
`npm start &` in one call and queries it in another will find nothing. This is the same in every arm.
If the sandbox cannot be used at all, run with `"isolation": "none"` only inside a VM or container
whose network reaches nothing but the API, and say so in the write-up.

## 5. The dry run (one real run)

```bash
npm run runner -- dry-run --phase pilot
```

Runs the first arm C run of the plan, scores it, records it in `results/pilot/dry-run.jsonl` (not in
the study's runs) and prints the estimate for the pilot and the projection for the full study.

## 6. The pilot

Set `budget_usd` in `BUDGET.md`, then:

```bash
npm run runner -- start --phase pilot            # add --confirm if the estimate is over the budget
npm run runner -- status --phase pilot
npm run analyze -- --phase pilot                 # results/pilot/summary.md and results/pilot/csv/
```

`start` runs the 54 runs in the seeded order, one at a time (`concurrency` in the config), and can be
stopped and started again: finished runs are not repeated. A run interrupted by stopping the runner
is not recorded and starts again from scratch. A run that ends in an error (the agent crashed, the
API failed, the wrong model answered, the testivai server did not connect) is retried once; both
attempts stay in `runs.jsonl`.

After the pilot, read `results/pilot/summary.md`: the cost per run and the projection, the tasks every
arm passed or every arm failed, and the shortcut signs. Read a sample of transcripts too. Anything
changed before the full run goes in `CHANGES_AFTER_PILOT.md`.

## What is written where

```
results/<phase>/
  plan.json           the runs and their order (written at the first start; a changed plan is refused)
  runs.jsonl          one line per attempt, never edited
  transcripts/        the agent's stream-json output per attempt, credentials removed
  diffs/              the agent's change per attempt, as a patch against the starting commit
  dry-run.jsonl, dry-run/
  summary.md, csv/    from npm run analyze
results/probe/        probe transcripts
```

Credentials are removed from every transcript, diff and error before it is written (any value of
`ANTHROPIC_API_KEY` and anything shaped like an Anthropic key). Read through the results before
publishing them anyway.
