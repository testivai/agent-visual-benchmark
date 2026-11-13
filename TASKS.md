# Tasks

This file is for readers. It is never given to the agent, and neither is anything under `oracle/`.
It is generated from the task files: `node tools/tasks-table.mjs`.

24 tasks: 14 fix, 6 change, 4 decoy.

- **fix**: a seeded visual regression and a vague report. Scored: everything the seed changed is back, and nothing else changed.
- **change**: an intended change where the obvious edit to shared CSS also changes another page. Scored: the change is made, and nothing else changed.
- **decoy**: nothing is wrong. Scored: no file under `site/` is changed.

Fix tasks by category:

- breakpoint-only: t05, t20
- failed-web-font: t08, t15
- layout-shift: t09, t18
- missing-or-duplicated: t06, t14
- overflow-or-clipping: t10, t17
- stacking-order: t01, t12
- style-only: t03, t22

| id | type | category | pages | what it is | a screenshot shows it (1280x800 / 390x844) |
| --- | --- | --- | --- | --- | --- |
| t01 | fix | stacking-order | pricing | The "Most popular" label on the highlighted plan is painted behind its card. | yes / yes |
| t02 | change | shared-css | contact | Make the Send message button as wide as the form. The form rule it uses also styles the newsletter form on the home page. | n/a |
| t03 | fix | style-only | products | Secondary buttons have white text on a white button, on every page that has one. | yes / yes |
| t04 | decoy | no-defect | home | Nothing is wrong: the hero illustration was re-exported with its shapes snapped to whole pixels. | yes / yes |
| t05 | fix | breakpoint-only | pricing | On a phone the three plans stay side by side instead of stacking. | no / yes |
| t06 | fix | missing-or-duplicated | products | One product card is in the page twice. | yes / yes |
| t07 | change | shared-css | pricing | Make the highlighted plan's button green. Its class is the primary button of every page. | n/a |
| t08 | fix | failed-web-font | all | The web font's URL is wrong, so every page falls back to a system font. | yes / yes |
| t09 | fix | layout-shift | orders | Two stray line breaks push the orders table down. | yes / yes |
| t10 | fix | overflow-or-clipping | contact | The long email address runs out of its card. | yes / yes |
| t11 | change | shared-css | home | Darken the grey text on the home page. The grey is one token used by every page. | n/a |
| t12 | fix | stacking-order | home | The stats strip that overlaps the hero is painted behind it. | yes / yes |
| t13 | decoy | no-defect | pricing | Nothing is wrong: three pricing rules were rewritten in an equivalent way. A control: nothing renders differently. | no / no |
| t14 | fix | missing-or-duplicated | orders | The Total heading of the orders table is gone. | yes / yes |
| t15 | fix | failed-web-font | all | The font rule declares the regular weight only, so bold text is a thickened regular. | yes / yes |
| t16 | change | shared-css | orders | Tighten the rows of the orders table. The table component is also the plan comparison on the pricing page. | n/a |
| t17 | fix | overflow-or-clipping | products | The New and Sale badges are cut off by their cards. | yes / yes |
| t18 | fix | layout-shift | home | The hero illustration was saved with a taller artboard, which pushes the page down. | yes / yes |
| t19 | decoy | no-defect | all | Nothing is wrong: the font file was re-exported on a finer grid, so text edges move by a fraction of a pixel. | yes / yes |
| t20 | fix | breakpoint-only | about | On a phone the About page's story stays in two columns, so the picture runs off the screen. | no / yes |
| t21 | change | shared-css | products | Set the products page's section headings in capitals. Their class is used on every page. | n/a |
| t22 | fix | style-only | contact | The space between the contact form's fields is gone. | yes / yes |
| t23 | change | shared-css | about | Centre the team cards. The card component is shared with three other pages. | n/a |
| t24 | decoy | no-defect | about | Nothing is wrong: the workshop picture was exported larger and is displayed at the same size. A control: no pixel is flagged. | no / no |

The last column is measured, not judged: full-page screenshots of the clean and the seeded app are
compared pixel by pixel at Playwright's default threshold (`npm run visibility`, results in
`oracle/visibility.json`). For a decoy it says whether a pixel comparison flags anything. It is a
property of the task. It is never used to score a run.

## Flags

- **Not visible at the default viewport (1280x800): t05, t20.** These defects exist only under the 720px breakpoint. An arm
  whose screenshots are taken at desktop width only cannot see them. Their reports say "on my phone".
- **Decoys where no pixel is flagged: t13, t24.** These are controls: every tool should say "no difference". The other
  decoys produce pixel differences above the default threshold with nothing wrong.
