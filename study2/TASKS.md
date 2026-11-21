# Study 2's task set

The set the study runs on, `study2/tasks.json`. This is a record of what was generated and checked;
the rules are in `study2/PREREGISTRATION.md`, frozen and tagged `study2-prereg-v1` before generation.

## Generated

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

## Kept per class

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

## Candidates rejected

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

## Validated

All 72 tasks pass `node study2/validate-tasks.mjs study2/tasks.json --arms` (log:
`study2/tasks.validation.txt`):
- the oracle's checks of the set and of each task;
- each arm's own visual test, run in each task's real workspace, flags every task:
  - in 64 tasks both arms flag both views;
  - in 8 (all S1), both flag the one view the change shows at;
  - the arms never disagree on a task.

## The pilot

Drawn with `seeds.pilot` 2026111902 (`node runner/run.mjs plan --study 2 --phase pilot`):
- **Site:** shop-item.
- **Tasks:** S1 `s2t41`, `s2t55`; S2 `s2t24`, `s2t69`; S3 `s2t20`, `s2t62`; S4 `s2t22`, `s2t48`.
- **Runs:** 48, in an order shuffled with `seeds.order` 2026111903.
