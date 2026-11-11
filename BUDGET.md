# Budget

The most the pilot may spend on API calls, in US dollars. **The maintainer sets it.** Set by the
maintainer on 2026-11-11, before the dry run.

The runner reads the line below. While it says `TODO`, `start` refuses to run. When the estimate
from the dry run (one run's cost × the number of runs) is over it, `start` refuses unless it is given
`--confirm`.

budget_usd: 100

The runner's figures come from Claude Code's own `total_cost_usd`, which is an estimate, not a bill.
Set a spend limit on the API key in the Console as well; it is the limit that holds if anything here
is wrong.
