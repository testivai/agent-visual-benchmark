# Phase 0 findings: is each way of running the agent isolated?

Checked on 2026-11-12 in the cloud session that runs the study, with Claude Code 2.1.322, before
any scored run. Every check below passed, after the fixes listed at the end.

## The three models

| model | login | why |
| --- | --- | --- |
| `claude-sonnet-5-5` (primary) | the maintainer's Claude subscription, through the session's own login | decided by the maintainer |
| `claude-opus-5-5` | the same | decided by the maintainer |
| `deepseek-flash` (DeepSeek-V4.1-Flash) | the maintainer's DeepSeek API key, held by the network proxy | the second model; the only DeepSeek model that takes images (`deepseek-v4-pro` is text only, and the maintainer chose to skip a model that fails the image check) |

## 0.1 The startup report, without a model call

`claude` was started with the planned settings and `ANTHROPIC_BASE_URL` pointed at a closed local
port, so it printed its startup report and could not reach a model.

- `--bare` mode refuses a subscription login (it accepts only `ANTHROPIC_API_KEY`), so the study
  runs Claude Code in its normal mode, locked down.
- On this machine the Claude login reaches every `claude` process, even one started with an empty
  environment and a fresh config directory. No credential is passed to a run.
- Without `--tools`, the agent got 21 tools in a clean environment, including `SendMessage`,
  `RemoteTrigger`, `CronCreate` and `Workflow`, which act on the account. With
  `--tools Bash,Edit,Read` it gets exactly Bash, Edit and Read, plus the testivai tools in arm C.
- This build loads three built-in plugins (`cc-plugin-agents-md`, `cc-plugin-privacy`,
  `cc-plugin-plugin-authoring`) and 17 bundled skills. Setting the plugins to `false` in
  `enabledPlugins` and passing `--disable-slash-commands` removes all of them.
- No hook ran (`--include-hook-events` reported none).

## 0.2 The isolation probe, one short real run per Claude model

The agent was asked to run five commands in an arm A workspace.

| check | Sonnet 5.5 | Opus 5.5 |
| --- | --- | --- |
| the functional tests pass inside the sandbox | 16 passed | 16 passed |
| `https://example.com` is blocked | blocked by the sandbox | blocked by the sandbox |
| the npm registry is reachable | 200 | 200 |
| a file of the benchmark's hidden answers can be read | no such file | no such file |
| a server started and queried in one command answers | yes | yes |
| Claude Code's cost estimate for the probe | $0.04 | $0.13 |

## 0.3 DeepSeek

- The key works and is held by the network proxy for `api.deepseek.com`; Claude Code is given a
  placeholder (`ANTHROPIC_AUTH_TOKEN=proxy-injected`) and `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`.
- DeepSeek maps any request for a `claude-opus*` model to `deepseek-v4-pro`, which is text only, and
  other `claude*` names to `deepseek-flash`. Every model Claude Code may ask for (the default Opus,
  Sonnet and Haiku models, the small fast model, the subagent model) is therefore set to
  `deepseek-flash`.
- **Image check: passed.** Through the same locked-down Claude Code, `deepseek-flash` opened a
  picture with the Read tool and answered "purple, 47" (a purple circle with 47 in it, a fact that
  is only in the pixels). Sonnet 5.5, as a control, gave the same answer.
- Prices, from DeepSeek's pricing page, per million tokens, peak (off-peak is half): input $0.30,
  cached input $0.006, output $1.20. Claude Code's own cost figure prices DeepSeek's tokens at
  Anthropic's rates and is wrong for it (about $0.02 instead of about $0.001 for the image check),
  so the runner computes DeepSeek's cost from the tokens.

## 0.4 The runner's own commands, after the fixes

The same checks again, run by the runner (`npm run runner -- probe --model <id>` and
`npm run runner -- image-check --model <id>`), with the startup check on:

| check | Sonnet 5.5 | DeepSeek-V4.1-Flash |
| --- | --- | --- |
| probe: tests pass, web blocked, registry reachable, benchmark unreadable, local server answers | all five | all five |
| image check | passed in 0.3 | passed, "purple, 47", with the Read tool only |

The startup reports of the real `claude`, started by the runner with no model reachable, passed the
startup check for Sonnet and DeepSeek in arms A and C (11 tools in C: Bash, Edit, Read and testivai's
eight, the testivai server connected).

## Problems found, and fixed before any scored run

1. **The packages copied into each workspace had broken links.** Node's `fs.cpSync` turns
   relative links into absolute ones by default, so `node_modules/.bin/playwright` pointed into a
   deleted build directory, and `npx playwright` fell back to a global Playwright that clashes with
   the workspace's. The functional tests then failed with "test.describe() called here". The copy
   now keeps links as they are, a workspace with a link that leads outside it is refused, and a test
   runs the agent's own `npx playwright test` inside a workspace.
2. **The sandbox told the agent the benchmark's directory name.** Claude Code tells the model
   which paths the sandbox blocks; both models named `/home/user/agent-visual-benchmark` as "on the
   sandbox's read-deny list". Every agent would have learned it was being tested. The runner now
   blocks the directory that holds the benchmark (here `/home/user`; on most machines the home
   directory) instead of naming it, and lets through only what a run needs to read (the browsers,
   Node). Probed again afterwards: the agents reported `/home/user` as blocked, nothing more.
3. **The sandbox leaves placeholder files in the working directory.** In a real run, `git status`
   showed `.bashrc`, `.bash_profile`, `.profile`, `.zshrc`, `.zprofile`, `.gitconfig`,
   `.gitmodules`, `.ripgreprc`, `.mcp.json`, `.claude/`, `.idea/` and `.vscode/` in the workspace,
   none of them the agent's doing. They are left out of the tamper check and the agent's diff, and
   listed in the workspace's `.git/info/exclude`, where the agent does not look.

## What this does not show

- That an agent cannot find some other way out. The runner also records the tools each run called
  and flags any access outside the workspace.
- How long a full task takes or what it uses up. The dry runs measure that.
