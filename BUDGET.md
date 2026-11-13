# Budget

The most each model's pilot may spend, set by the maintainer before its dry run. The runner reads the
`budget_usd.<model>` lines below (the model ids are those in `runner.config.json`).

- A dollar amount: `start` refuses while the estimate from the dry run (one run's cost × the number of
  runs) is over it, unless it is given `--confirm`. The cost is computed from the provider's prices
  in `runner.config.json`.
- `subscription`: the model runs on the maintainer's Claude subscription. Nothing is billed per token;
  usage counts against the plan's limits, and a run cut off by a limit waits for the reset and runs
  again. The runner still reports Claude Code's API-equivalent estimate.
- `TODO` or no line: `start` refuses.

budget_usd.sonnet: subscription
budget_usd.opus: subscription
budget_usd.deepseek: 20

Set 2026-11-12 by the maintainer: Sonnet 5.5 and Opus 5.5 on the subscription, $20 for DeepSeek.
Set a spend limit on the DeepSeek key with DeepSeek as well; it is the limit that holds if anything
here is wrong.
