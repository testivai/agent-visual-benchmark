# Study 2's task sets

The rules are in `study2/PREREGISTRATION.md`, frozen and tagged `study2-prereg-v1` before any set
was generated. Both sets come from `seeds.generation` (2026111901); they differ only by the rung of
the difficulty ladder (section 7).

| set | file | rung | status |
| --- | --- | --- | --- |
| second | `study2/tasks.json` | 1: two mutations per S1 task, three in S2 | in use |
| first | `study2/tasks-rung0.json` | 0: as drafted | its pilot was too easy |

**Why there are two.** The first pilot ran on the rung 0 set. Pooled over B and C on S1 to S3, 35
of its 36 runs succeeded (97%), above the 85% line, so the frozen ladder called for rung 1
(`results/study2/sonnet/pilot/calibration.json`). The whole set was then generated again with the
same seed under rung 1, validated again, and its pilot runs again. No per-arm result of the first
pilot was computed.

## The set in use: rung 1

### Generated

- **When and from what:** 2026-11-21, from commit `bb4537f`, which adds rung 1 to the generator.
  `seeds.generation` 2026111901, on Chromium 153.0.8010.12. Committed as generated (`2fbaa71`)
  before its validation finished.
- **Tasks:** 72. S1 20 (two mutations each), S2 20 (three each), S3 20 (one each), S4 12; 12 on
  each of the six sites. The slots and ids are the same as the first set's.
- **Mutations:** 120, kept from 317 candidates, in 528 s.

### Kept per class

| class | kept | | class | kept |
| --- | --- | --- | --- | --- |
| colour | 15 | | padding | 10 |
| margin | 15 | | position and z-index | 9 |
| display and flex | 14 | | line height | 9 |
| width | 14 | | border | 5 |
| font size | 12 | | background | 3 |
| font weight | 10 | | text transform | 2 |
| letter spacing, opacity | 1 each | | overflow | 0 |

**Classes with nothing left on a site that shows** (dead by the end of the generation, as the
deck used each site's supply up):

| site | dead classes |
| --- | --- |
| agency | opacity, overflow |
| bare | background, font size, letter spacing, line height, padding, position and z-index, opacity, overflow, text transform |
| full-width-pics | background, font weight, letter spacing, position and z-index, border, opacity, overflow, text transform |
| heroic-features | background, font weight, letter spacing, line height, position and z-index, border, opacity, overflow, text transform |
| shop-item | background, letter spacing, opacity, overflow, text transform |
| small-business | background, font weight, letter spacing, line height, border, opacity, overflow, text transform |

### Candidates rejected

- **183:** no measured change on a rendered element.
- **10:** no pixel changed.
- **4, by the arms' checks:**
  - **Flagged by TestivAI's check, not by Playwright's (2):**
    - full-width-pics: `.rounded-circle` border-radius `50%` → `25%`;
    - heroic-features: `.btn-primary` border colour `#0d6efd` → `#fd9c0d`.
  - **Flagged by neither (2):**
    - shop-item: `.text-muted` colour `#6c757d` → `#828b93`;
    - small-business: `--bs-secondary-rgb` `108, 117, 125` → `130, 139, 147`.

    Both are mid greys, whose lightness inverted moves little.
  - **Flagged by Playwright's check, not by TestivAI's:** none.

### Validated

All 72 tasks pass `node study2/validate-tasks.mjs study2/tasks.json --arms`, which checks the set
against rung 1's rules (log: `study2/tasks.validation.txt`):
- the oracle's checks of the set and of each task;
- each arm's own visual test, run in each task's real workspace, flags every task:
  - in 70 tasks both arms flag both views;
  - in 2, both flag the one view the change shows at;
  - the arms never disagree on a task.

### Its pilot

- **Drawn with `seeds.pilot` 2026111902:** the same site and task ids as the first pilot (shop-item;
  S1 `s2t41`, `s2t55`; S2 `s2t24`, `s2t69`; S3 `s2t20`, `s2t62`; S4 `s2t22`, `s2t48`). The ids
  are the same, but the mutations are rung 1's.
- **48 runs,** in the same order. Their run ids carry the rung (`pilot-r1-001`), and their results
  go to `results/study2/sonnet/pilot-rung1/`, so the two pilots never mix.
- **Calibration** (arm-blind, `results/study2/sonnet/pilot-rung1/calibration.json`):
  - Pooled over B and C on S1 to S3, 30 of 36 runs succeeded (83%). That is inside the 40–85%
    band, so the decision is to keep: the difficulty is settled at rung 1.
  - The SD of the per-task C − B difference is 0 over the 6 tasks, so the power rule adds no task.
    The full study is 72 tasks, 60 of them in S1 to S3.
  - **An SD of 0 from 6 tasks is a weak estimate,** not evidence that the true spread is 0. The
    study's power is therefore less certain than the rule's figure (100%) suggests: section 6's
    table gives 83% at an SD of 0.3 and 61% at 0.4. The write-up says so.

## The first set: rung 0 (its pilot was too easy)

### Generated

- **When and from what:** 2026-11-21, from the tagged freeze commit (`381e527`), with
  `seeds.generation` 2026111901, on Chromium 153.0.8010.12. The set was committed as generated
  (`a83e33c`) before its validation finished.
- **Tasks:** 72. S1 20, S2 20, S3 20, S4 12; 12 on each of the six sites.
- **Mutations:** 84, kept from 215 candidates.
- **S2:** 16 tasks with two mutations and 4 with three.
  - At even odds, a split this uneven happens about 0.6% of the time.
  - A check over 2,000 seeds shows the generator's draws are fair: on average 10.03 tasks with
    two, SD 2.25, as fair odds predict.
  - Under the frozen rules, the set stands as generated.

### Kept per class

| class | kept | | class | kept |
| --- | --- | --- | --- | --- |
| colour | 11 | | position and z-index | 7 |
| margin | 10 | | font weight | 6 |
| width | 10 | | padding | 6 |
| font size | 9 | | border | 4 |
| display and flex | 8 | | background | 2 |
| line height | 8 | | text transform | 2 |
| letter spacing | 1 | | opacity, overflow | 0 |

**Classes that could show nothing on a site** ("dead"; the deck skips them there):

| site | dead classes |
| --- | --- |
| agency | overflow |
| bare | background, letter spacing, line height, padding, opacity, overflow, text transform |
| full-width-pics | background, letter spacing, position and z-index, border, opacity, overflow, text transform |
| heroic-features | background, font weight, letter spacing, border, opacity, overflow, text transform |
| shop-item | letter spacing, opacity, overflow |
| small-business | background, font weight, letter spacing, border, opacity, overflow, text transform |

### Candidates rejected

- **118:** no measured change on a rendered element.
- **7:** no pixel changed.
- **6, by the arms' checks** (the preregistration asks the write-up to report these):
  - **Flagged by TestivAI's check, not by Playwright's (4):**
    - shop-item: `.form-control` border `1px solid #ced4da` → `0px solid #ced4da` (a form field's
      border removed);
    - shop-item: `.form-control` border-radius `0.375rem` → `0.188rem`;
    - full-width-pics: `.rounded-circle` border-radius `50%` → `25%`;
    - heroic-features: `:root` `--bs-gradient`, the gradient's white turned to black at 15%.
  - **Flagged by neither (2):**
    - bare: the navbar toggler's border colour at 10% opacity;
    - small-business: `--bs-secondary-rgb` `108, 117, 125` → `130, 139, 147`. A mid grey has its
      lightness inverted, which moves it little.
  - **Flagged by Playwright's check, not by TestivAI's:** none.

### Validated

All 72 tasks pass `node study2/validate-tasks.mjs study2/tasks-rung0.json --arms` (log:
`study2/tasks-rung0.validation.txt`):
- the oracle's checks of the set and of each task;
- each arm's own visual test, run in each task's real workspace, flags every task:
  - in 64 tasks both arms flag both views;
  - in 8 (all S1), both flag the one view the change shows at;
  - the arms never disagree on a task.

### Its pilot

Drawn with `seeds.pilot` 2026111902 (`node runner/run.mjs plan --study 2 --phase pilot`):
- **Site:** shop-item.
- **Tasks:** S1 `s2t41`, `s2t55`; S2 `s2t24`, `s2t69`; S3 `s2t20`, `s2t62`; S4 `s2t22`, `s2t48`.
- **Runs:** 48, in an order shuffled with `seeds.order` 2026111903.
