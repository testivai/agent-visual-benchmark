# Results: deepseek, pilot

Runs: 54 (54 attempts). Scored: 54. Errors: 0 (excluded from the rates below, listed at the end).

Turns, the done claim and the agent's time are read again from each transcript with the current parser (analysis/rederive.mjs); runs.jsonl is left as recorded. 18 of 54 runs differ from runs.jsonl: pilot-003 (turns, claimed_done, false_done), pilot-004 (turns), pilot-006 (turns), pilot-007 (turns), pilot-016 (turns), pilot-020 (turns), pilot-024 (turns), pilot-025 (turns), pilot-026 (turns), pilot-036 (turns), pilot-038 (turns), pilot-039 (turns), pilot-045 (turns), pilot-046 (turns), pilot-048 (turns), pilot-052 (turns), pilot-053 (turns), pilot-054 (turns).

**This is the pilot. It is too small for conclusions: no significance claims are made from it.** It measures cost and finds broken or uninformative tasks.

## Per arm

| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds (agent) | median cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 18 | 67% (44% to 84%) | 5/17 | 2/18 | 0 | 35 | 517308 | 88 | $0.02 |
| B | 18 | 83% (61% to 94%) | 3/17 | 0/18 | 1 | 28 | 288283 | 75 | $0.01 |
| C | 18 | 89% (67% to 97%) | 2/18 | 0/18 | 0 | 28 | 540721 | 111 | $0.02 |

## Paired by task: fix and change tasks (the primary metric)

Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (10000 resamples, seed 1).

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +7 points | +0 points to +20 points | +0 points |
| C-A | 5 | +20 points | +0 points to +47 points | +0 points |
| B-A | 5 | +13 points | -13 points to +47 points | -13 points |

## Decoys, on their own

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 1 | +0 points | +0 points to +0 points | +0 points |
| C-A | 1 | +33 points | +33 points to +33 points | +33 points |
| B-A | 1 | +33 points | +33 points to +33 points | +33 points |

## Lenient rate: the symptom gone, values restored or not (fix and change tasks)

| arm | A | B | C |
| --- | --- | --- | --- |
| lenient success | 12/15 80% (55% to 93%) | 14/15 93% (70% to 99%) | 15/15 100% (80% to 100%) |
| strict success | 12/15 80% (55% to 93%) | 14/15 93% (70% to 99%) | 15/15 100% (80% to 100%) |

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +7 points | +0 points to +20 points | +0 points |
| C-A | 5 | +20 points | +0 points to +47 points | +0 points |
| B-A | 5 | +13 points | -13 points to +47 points | -13 points |

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
| decoy | 0/3 0% (0% to 56%) | 1/3 33% (6% to 79%) | 1/3 33% (6% to 79%) |
| fix | 9/12 75% (47% to 91%) | 12/12 100% (76% to 100%) | 12/12 100% (76% to 100%) |

## By category

| category | A | B | C |
| --- | --- | --- | --- |
| failed-web-font | 5/6 83% (44% to 97%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| no-defect | 0/3 0% (0% to 56%) | 1/3 33% (6% to 79%) | 1/3 33% (6% to 79%) |
| overflow-or-clipping | 4/6 67% (30% to 90%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| shared-css | 3/3 100% (44% to 100%) | 2/3 67% (21% to 94%) | 3/3 100% (44% to 100%) |

## Every task

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t08 | fix | failed-web-font | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t10 | fix | overflow-or-clipping | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t15 | fix | failed-web-font | 67% (n=3) | 100% (n=3) | 100% (n=3) |
| t17 | fix | overflow-or-clipping | 33% (n=3) | 100% (n=3) | 100% (n=3) |
| t19 | decoy | no-defect | 0% (n=3) | 33% (n=3) | 33% (n=3) |
| t21 | change | shared-css | 100% (n=3) | 67% (n=3) | 100% (n=3) |

## Pilot: cost, time and tasks that cannot tell the arms apart

- Measured cost per run: mean $0.03, median $0.02; total $1.41.
- Measured wall time per run, waits included: mean 292 s.
- Projected cost of the full 360 runs at the pilot's mean: $9.40. Tasks outside the pilot may cost more or less.
- Tasks where every arm scored 0% or every arm 100%: t08 (100%), t10 (100%).

## Signs of shortcuts

Counted from the tool calls in each transcript (see runner/transcript.mjs). Tampering is in the per-arm table: it makes a run a failure.

- A: outside_workspace 3, bench_access 1
- B: viewed_baseline 8, update_snapshots 1
- C: viewed_baseline 10

## Errors

None.
