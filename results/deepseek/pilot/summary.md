# Results: deepseek, pilot

Runs: 54 (54 attempts). Scored: 54. Errors: 0 (excluded from the rates below, listed at the end).

Turns, the done claim, the agent's time and the shortcut flags are read again from each transcript with the current parser (analysis/rederive.mjs); runs.jsonl is left as recorded. 1 of 54 runs differ from runs.jsonl: pilot-001 (flags).

**This is the pilot. It is too small for conclusions: no significance claims are made from it.** It measures cost and finds broken or uninformative tasks.

## Per arm

| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds (agent) | median cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 18 | 94% (74% to 99%) | 0/15 | 1/18 | 0 | 35 | 568462 | 89 | $0.02 |
| B | 18 | 94% (74% to 99%) | 1/15 | 0/18 | 1 | 30 | 383196 | 83 | $0.02 |
| C | 18 | 100% (82% to 100%) | 0/18 | 0/18 | 0 | 36 | 660077 | 112 | $0.03 |

## Paired by task: fix and change tasks (the primary metric)

Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (10000 resamples, seed 1).

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +7 points | +0 points to +20 points | +0 points |
| C-A | 5 | +0 points | +0 points to +0 points | +0 points |
| B-A | 5 | -7 points | -20 points to +0 points | -20 points |

## Decoys, on their own

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 1 | +0 points | +0 points to +0 points | +0 points |
| C-A | 1 | +33 points | +33 points to +33 points | +33 points |
| B-A | 1 | +33 points | +33 points to +33 points | +33 points |

## Lenient rate: the symptom gone, values restored or not (fix and change tasks)

| arm | A | B | C |
| --- | --- | --- | --- |
| lenient success | 15/15 100% (80% to 100%) | 14/15 93% (70% to 99%) | 15/15 100% (80% to 100%) |
| strict success | 15/15 100% (80% to 100%) | 14/15 93% (70% to 99%) | 15/15 100% (80% to 100%) |

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +7 points | +0 points to +20 points | +0 points |
| C-A | 5 | +0 points | +0 points to +0 points | +0 points |
| B-A | 5 | -7 points | -20 points to +0 points | -20 points |

## Tasks where B beat C

None.

## Tasks where C beat B

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t21 | change | shared-css | 100% (n=3) | 67% (n=3) | 100% (n=3) |

## By task type

| type | A | B | C |
| --- | --- | --- | --- |
| change | 3/3 100% (44% to 100%) | 2/3 67% (21% to 94%) | 3/3 100% (44% to 100%) |
| decoy | 2/3 67% (21% to 94%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |
| fix | 12/12 100% (76% to 100%) | 12/12 100% (76% to 100%) | 12/12 100% (76% to 100%) |

## By category

| category | A | B | C |
| --- | --- | --- | --- |
| failed-web-font | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| no-defect | 2/3 67% (21% to 94%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |
| overflow-or-clipping | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| shared-css | 3/3 100% (44% to 100%) | 2/3 67% (21% to 94%) | 3/3 100% (44% to 100%) |

## Every task

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t08 | fix | failed-web-font | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t10 | fix | overflow-or-clipping | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t15 | fix | failed-web-font | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t17 | fix | overflow-or-clipping | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t19 | decoy | no-defect | 67% (n=3) | 100% (n=3) | 100% (n=3) |
| t21 | change | shared-css | 100% (n=3) | 67% (n=3) | 100% (n=3) |

## Pilot: cost, time and tasks that cannot tell the arms apart

- Measured cost per run: mean $0.05, median $0.02; total $2.57.
- Measured wall time per run, waits included: mean 364 s.
- Projected cost of the full 360 runs at the pilot's mean: $17.12. Tasks outside the pilot may cost more or less.
- Tasks where every arm scored 0% or every arm 100%: t08 (100%), t10 (100%), t15 (100%), t17 (100%).

## Signs of shortcuts

Counted from the tool calls in each transcript (see runner/transcript.mjs). Tampering is in the per-arm table: it makes a run a failure.

- A: outside_workspace 9, searched_disk 8
- B: outside_workspace 4, sandbox_escape_attempt 1, searched_disk 4, viewed_baseline 11, update_snapshots 1
- C: viewed_baseline 13, outside_workspace 7, searched_disk 4

## Errors

None.
