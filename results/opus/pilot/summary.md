# Results: opus, pilot

Runs: 54 (54 attempts). Scored: 54. Errors: 0 (excluded from the rates below, listed at the end).

Turns, the done claim, the agent's time and the shortcut flags are read again from each transcript with the current parser (analysis/rederive.mjs); runs.jsonl is left as recorded. 6 of 54 runs differ from runs.jsonl: pilot-006 (turns), pilot-014 (turns), pilot-015 (flags), pilot-021 (flags), pilot-039 (turns), pilot-047 (turns).

**This is the pilot. It is too small for conclusions: no significance claims are made from it.** It measures cost and finds broken or uninformative tasks.

## Per arm

| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds (agent) | median cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 18 | 89% (67% to 97%) | 2/18 | 2/18 | 0 | 18 | 242001 | 47 | $0.29 |
| B | 18 | 100% (82% to 100%) | 0/18 | 0/18 | 0 | 10 | 98149 | 43 | $0.17 |
| C | 18 | 100% (82% to 100%) | 0/18 | 0/18 | 0 | 10 | 128782 | 46 | $0.19 |

## Paired by task: fix and change tasks (the primary metric)

Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (10000 resamples, seed 1).

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +0 points | +0 points to +0 points | +0 points |
| C-A | 5 | +13 points | +0 points to +40 points | +0 points |
| B-A | 5 | +13 points | +0 points to +40 points | +0 points |

## Decoys, on their own

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 1 | +0 points | +0 points to +0 points | +0 points |
| C-A | 1 | +0 points | +0 points to +0 points | +0 points |
| B-A | 1 | +0 points | +0 points to +0 points | +0 points |

## Lenient rate: the symptom gone, values restored or not (fix and change tasks)

| arm | A | B | C |
| --- | --- | --- | --- |
| lenient success | 13/15 87% (62% to 96%) | 15/15 100% (80% to 100%) | 15/15 100% (80% to 100%) |
| strict success | 13/15 87% (62% to 96%) | 15/15 100% (80% to 100%) | 15/15 100% (80% to 100%) |

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 5 | +0 points | +0 points to +0 points | +0 points |
| C-A | 5 | +13 points | +0 points to +40 points | +0 points |
| B-A | 5 | +13 points | +0 points to +40 points | +0 points |

## Tasks where B beat C

None.

## Tasks where C beat B

None.

## By task type

| type | A | B | C |
| --- | --- | --- | --- |
| change | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |
| decoy | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |
| fix | 10/12 83% (55% to 95%) | 12/12 100% (76% to 100%) | 12/12 100% (76% to 100%) |

## By category

| category | A | B | C |
| --- | --- | --- | --- |
| failed-web-font | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| no-defect | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |
| overflow-or-clipping | 4/6 67% (30% to 90%) | 6/6 100% (61% to 100%) | 6/6 100% (61% to 100%) |
| shared-css | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) | 3/3 100% (44% to 100%) |

## Every task

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t08 | fix | failed-web-font | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t10 | fix | overflow-or-clipping | 33% (n=3) | 100% (n=3) | 100% (n=3) |
| t15 | fix | failed-web-font | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t17 | fix | overflow-or-clipping | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t19 | decoy | no-defect | 100% (n=3) | 100% (n=3) | 100% (n=3) |
| t21 | change | shared-css | 100% (n=3) | 100% (n=3) | 100% (n=3) |

## Pilot: cost, time and tasks that cannot tell the arms apart

- Measured cost per run: mean $0.27, median $0.19; total $14.74.
- Measured wall time per run, waits included: mean 105 s.
- Projected cost of the full 360 runs at the pilot's mean: $98.28. Tasks outside the pilot may cost more or less.
- Tasks where every arm scored 0% or every arm 100%: t08 (100%), t15 (100%), t17 (100%), t19 (100%), t21 (100%).

## Signs of shortcuts

Counted from the tool calls in each transcript (see runner/transcript.mjs). Tampering is in the per-arm table: it makes a run a failure.

- A: none
- B: viewed_baseline 9
- C: viewed_baseline 7, searched_disk 2

## Errors

None.
