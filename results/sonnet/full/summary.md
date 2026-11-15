# Results: sonnet, full

Runs: 360 (360 attempts). Scored: 360. Errors: 0 (excluded from the rates below, listed at the end).

Turns, the done claim, the agent's time and the shortcut flags are read again from each transcript with the current parser (analysis/rederive.mjs); runs.jsonl is left as recorded. 5 of 360 runs differ from runs.jsonl: full-139 (flags), full-172 (flags), full-251 (flags), full-266 (flags), full-340 (flags).

## H1 and the kill line (preregistered)

- C − B over the 20 fix and change tasks: +1 points; one-sided 95% interval: above +0 points.
- H1 is not supported: the one-sided interval reaches 0.
- The kill line was reached (under 10 points, or the one-sided interval reaches 0): TestivAI did not measurably help over a pixel comparison in this study.

## Per arm

| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds (agent) | median cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 120 | 83% (76% to 89%) | 19/120 | 19/120 | 0 | 8 | 95320 | 23 | $0.08 |
| B | 120 | 98% (94% to 100%) | 2/120 | 1/120 | 1 | 9 | 89492 | 31 | $0.08 |
| C | 120 | 99% (95% to 100%) | 1/120 | 1/120 | 0 | 9 | 119325 | 36 | $0.09 |

## Paired by task: fix and change tasks (the primary metric)

Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (10000 resamples, seed 1).

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 20 | +1 points | +0 points to +3 points | +0 points |
| C-A | 20 | +11 points | +2 points to +23 points | +2 points |
| B-A | 20 | +10 points | +0 points to +23 points | +1 points |

## Decoys, on their own

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 4 | +0 points | +0 points to +0 points | +0 points |
| C-A | 4 | +40 points | +10 points to +80 points | +10 points |
| B-A | 4 | +40 points | +10 points to +80 points | +10 points |

## Lenient rate: the symptom gone, values restored or not (fix and change tasks)

| arm | A | B | C |
| --- | --- | --- | --- |
| lenient success | 88/100 88% (80% to 93%) | 98/100 98% (93% to 99%) | 99/100 99% (95% to 100%) |
| strict success | 88/100 88% (80% to 93%) | 98/100 98% (93% to 99%) | 99/100 99% (95% to 100%) |

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 20 | +1 points | +0 points to +3 points | +0 points |
| C-A | 20 | +11 points | +2 points to +23 points | +2 points |
| B-A | 20 | +10 points | +0 points to +23 points | +1 points |

## Tasks where B beat C

None.

## Tasks where C beat B

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t07 | change | shared-css | 100% (n=5) | 80% (n=5) | 100% (n=5) |

## By task type

| type | A | B | C |
| --- | --- | --- | --- |
| change | 29/30 97% (83% to 99%) | 28/30 93% (79% to 98%) | 29/30 97% (83% to 99%) |
| decoy | 12/20 60% (39% to 78%) | 20/20 100% (84% to 100%) | 20/20 100% (84% to 100%) |
| fix | 59/70 84% (74% to 91%) | 70/70 100% (95% to 100%) | 70/70 100% (95% to 100%) |

## By category

| category | A | B | C |
| --- | --- | --- | --- |
| breakpoint-only | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| failed-web-font | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| layout-shift | 8/10 80% (49% to 94%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| missing-or-duplicated | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| no-defect | 12/20 60% (39% to 78%) | 20/20 100% (84% to 100%) | 20/20 100% (84% to 100%) |
| overflow-or-clipping | 5/10 50% (24% to 76%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| shared-css | 29/30 97% (83% to 99%) | 28/30 93% (79% to 98%) | 29/30 97% (83% to 99%) |
| stacking-order | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |
| style-only | 6/10 60% (31% to 83%) | 10/10 100% (72% to 100%) | 10/10 100% (72% to 100%) |

## Every task

| task | type | category | A | B | C |
| --- | --- | --- | --- | --- | --- |
| t01 | fix | stacking-order | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t02 | change | shared-css | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t03 | fix | style-only | 60% (n=5) | 100% (n=5) | 100% (n=5) |
| t04 | decoy | no-defect | 0% (n=5) | 100% (n=5) | 100% (n=5) |
| t05 | fix | breakpoint-only | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t06 | fix | missing-or-duplicated | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t07 | change | shared-css | 100% (n=5) | 80% (n=5) | 100% (n=5) |
| t08 | fix | failed-web-font | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t09 | fix | layout-shift | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t10 | fix | overflow-or-clipping | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t11 | change | shared-css | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t12 | fix | stacking-order | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t13 | decoy | no-defect | 80% (n=5) | 100% (n=5) | 100% (n=5) |
| t14 | fix | missing-or-duplicated | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t15 | fix | failed-web-font | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t16 | change | shared-css | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t17 | fix | overflow-or-clipping | 0% (n=5) | 100% (n=5) | 100% (n=5) |
| t18 | fix | layout-shift | 60% (n=5) | 100% (n=5) | 100% (n=5) |
| t19 | decoy | no-defect | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t20 | fix | breakpoint-only | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t21 | change | shared-css | 100% (n=5) | 100% (n=5) | 100% (n=5) |
| t22 | fix | style-only | 60% (n=5) | 100% (n=5) | 100% (n=5) |
| t23 | change | shared-css | 80% (n=5) | 80% (n=5) | 80% (n=5) |
| t24 | decoy | no-defect | 60% (n=5) | 100% (n=5) | 100% (n=5) |

## Signs of shortcuts

Counted from the tool calls in each transcript (see runner/transcript.mjs). Tampering is in the per-arm table: it makes a run a failure.

- A: none
- B: viewed_baseline 28, update_snapshots 1
- C: viewed_baseline 11

## Errors

None.
