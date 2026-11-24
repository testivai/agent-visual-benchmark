# Study 2 results: sonnet, full-rung1

Runs: 432 (432 attempts). Scored: 432. Errors: 0 (excluded from the rates below, listed at the end).

Turns, the done claim, the agent's time and the shortcut flags are read again from each transcript with the current parser (analysis/rederive.mjs); runs.jsonl is left as recorded. 16 of 432 runs differ from runs.jsonl: full-r1-049 (flags), full-r1-077 (flags), full-r1-115 (flags), full-r1-124 (flags), full-r1-131 (flags), full-r1-133 (flags), full-r1-139 (flags), full-r1-157 (flags), full-r1-165 (flags), full-r1-228 (flags), full-r1-307 (flags), full-r1-330 (flags), full-r1-363 (flags), full-r1-379 (flags), full-r1-399 (flags), full-r1-422 (flags).

## H1, H2 and the kill line (preregistered)

- H1: C − B over the 60 S1 to S3 tasks: +2.2 points; one-sided 95% bound: -0.6 points; bootstrap p = 0.114.
- H2: C's tokens over B's (per-task median, paired, log scale) over 60 tasks: 1.17× (95% interval 1.03× to 1.33×); two-sided bootstrap p = 0.018.

| test | p | Holm-adjusted p | rejected at 5% overall |
| --- | --- | --- | --- |
| H1 | 0.114 | 0.114 | no |
| H2 | 0.018 | 0.036 | yes |

- H1 is not supported: Holm's procedure does not reject it.
- H2: Holm's procedure rejects it, so C and B differ in tokens per run.
- The kill line was reached (C − B under 10 points, or its one-sided interval reaches 0): TestivAI did not measurably help over a pixel comparison in study 2 either.
- B succeeded in 166/180 S1 to S3 runs (92%), so C − B could be at most +7.8 points: the kill line's 10 points could not be reached whatever C did.

## Per arm

| arm | runs | success (95% Wilson) | false "done" | collateral broken | tampered | median turns | median tokens | median seconds (agent) | median cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B | 216 | 94% (89% to 96%) | 2/216 | 3/216 | 0 | 17 | 259505 | 43 | $0.17 |
| C | 216 | 95% (92% to 97%) | 1/215 | 0/216 | 0 | 16 | 337827 | 40 | $0.20 |

## Success by stratum

S1 to S3 are the primary tasks; S3 and S4 have drifted baselines; S4 is the decoys (nothing to fix).

| stratum | B | C |
| --- | --- | --- |
| S1 | 58/60 97% (89% to 99%) | 59/60 98% (91% to 100%) |
| S2 | 59/60 98% (91% to 100%) | 60/60 100% (94% to 100%) |
| S3 | 49/60 82% (70% to 89%) | 51/60 85% (74% to 92%) |
| S4 | 36/36 100% (90% to 100%) | 36/36 100% (90% to 100%) |

## Effort by stratum (description, not a test)

Medians per run. The last column is H2's measure taken in each stratum on its own (C's tokens over B's, the per-task median, paired), with its 95% bootstrap interval; it carries no p-value.

| stratum | turns B | turns C | tokens B | tokens C | agent seconds B | agent seconds C | tokens C/B, per task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | 13 | 15 | 183576 | 298454 | 33 | 36 | 1.49× (1.28× to 1.75×) |
| S2 | 17 | 17 | 253793 | 360251 | 41 | 39 | 1.33× (1.12× to 1.57×) |
| S3 | 27 | 19 | 632419 | 440615 | 116 | 51 | 0.81× (0.65× to 1.01×) |
| S4 | 12 | 13 | 193382 | 232411 | 33 | 30 | 0.91× (0.63× to 1.26×) |

## Paired by task: S1 to S3 (the primary metric)

Each task's success rate is the mean of its repeats; the difference is averaged over tasks, with a percentile bootstrap over tasks (10000 resamples, seed 1).

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 60 | +2.2 points | -1.1 points to +6.1 points | -0.6 points |

## Decoys (S4), on their own

| comparison | tasks | mean difference | 95% bootstrap interval | one-sided 95%: above |
| --- | --- | --- | --- | --- |
| C-B | 12 | +0.0 points | +0.0 points to +0.0 points | +0.0 points |

## Partial credit in S2 (description)

- Mean share of a task's mutations restored: B 0.994 over 60 runs, C 1.000 over 60 runs.
- Paired by task, C − B: +0.6 points (95% interval +0.0 points to +1.7 points), over 20 tasks.
- Known limit (PREREGISTRATION.md, section 5): where two mutations move the same elements, neither counts until both are restored there, so partial credit can undercount a half-done fix.

## Tasks where B beat C

| task | type | category | B | C |
| --- | --- | --- | --- | --- |
| s2t25 | fix | S1 | 100% (n=3) | 67% (n=3) |
| s2t45 | fix | S3 | 100% (n=3) | 67% (n=3) |
| s2t68 | fix | S3 | 33% (n=3) | 0% (n=3) |

## Tasks where C beat B

| task | type | category | B | C |
| --- | --- | --- | --- | --- |
| s2t07 | fix | S3 | 67% (n=3) | 100% (n=3) |
| s2t08 | fix | S1 | 67% (n=3) | 100% (n=3) |
| s2t49 | fix | S3 | 33% (n=3) | 100% (n=3) |
| s2t50 | fix | S1 | 67% (n=3) | 100% (n=3) |
| s2t59 | fix | S3 | 67% (n=3) | 100% (n=3) |
| s2t66 | fix | S2 | 67% (n=3) | 100% (n=3) |

## Against the pilot that sized the study

The pilot's own measures (study2/calibration.mjs), on the pilot and on the full study. The pilot ran on one site.

| | pilot | full study |
| --- | --- | --- |
| pooled success, S1 to S3 | 30/36 (83%) | 336/360 (93%) |
| per-task SD of C − B | 0.00 over 6 tasks | 0.15 over 60 tasks |
| power at 60 tasks for a true 10 points | 100% | 100% |

## The task generation: which comparator flags the candidates

Of the 317 candidates drawn, 124 had a measured change on a rendered element and changed pixels. Playwright's comparator flagged 120 of them and TestivAI's 122: 2 only TestivAI's, 0 only Playwright's, 2 neither. The validity filter kept only what both flagged.

## Every task

| task | type | category | B | C |
| --- | --- | --- | --- | --- |
| s2t01 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t02 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t03 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t04 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t05 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t06 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t07 | fix | S3 | 67% (n=3) | 100% (n=3) |
| s2t08 | fix | S1 | 67% (n=3) | 100% (n=3) |
| s2t09 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t10 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t11 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t12 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t13 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t14 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t15 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t16 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t17 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t18 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t19 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t20 | fix | S3 | 0% (n=3) | 0% (n=3) |
| s2t21 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t22 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t23 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t24 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t25 | fix | S1 | 100% (n=3) | 67% (n=3) |
| s2t26 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t27 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t28 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t29 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t30 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t31 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t32 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t33 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t34 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t35 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t36 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t37 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t38 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t39 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t40 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t41 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t42 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t43 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t44 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t45 | fix | S3 | 100% (n=3) | 67% (n=3) |
| s2t46 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t47 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t48 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t49 | fix | S3 | 33% (n=3) | 100% (n=3) |
| s2t50 | fix | S1 | 67% (n=3) | 100% (n=3) |
| s2t51 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t52 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t53 | fix | S3 | 33% (n=3) | 33% (n=3) |
| s2t54 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t55 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t56 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t57 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t58 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t59 | fix | S3 | 67% (n=3) | 100% (n=3) |
| s2t60 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t61 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t62 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t63 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t64 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t65 | fix | S1 | 100% (n=3) | 100% (n=3) |
| s2t66 | fix | S2 | 67% (n=3) | 100% (n=3) |
| s2t67 | fix | S3 | 100% (n=3) | 100% (n=3) |
| s2t68 | fix | S3 | 33% (n=3) | 0% (n=3) |
| s2t69 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t70 | fix | S2 | 100% (n=3) | 100% (n=3) |
| s2t71 | decoy | S4 | 100% (n=3) | 100% (n=3) |
| s2t72 | fix | S1 | 100% (n=3) | 100% (n=3) |

## Signs of shortcuts

Counted from the tool calls in each transcript (runner/transcript.mjs). Tampering, which fails a run, is in the per-arm table. outside_workspace counts any path outside the run's project and TMPDIR that is not a system directory: the run's own directory around them, and system files such as /etc/fonts, count too.

- B: outside_workspace 11, searched_disk 7, viewed_baseline 54
- C: outside_workspace 1, searched_disk 2, viewed_baseline 132

## Cost (API-equivalent)

- Total: $89.58 over 432 runs; B $45.43, C $44.14.
- Per run: mean $0.21, median $0.18; mean wall time 58 s, waits included.

## Errors

None.
