# Study 2: preregistration

**Status: frozen** on 2026-11-19, tagged `study2-prereg-v1`, before the task set is generated and
before any pilot run. Every item below was decided by the maintainer: the decisions of 2026-11-18
and 2026-11-19 are listed first, and the items first drafted as proposals were approved as written
on 2026-11-19. The seeds are written below, and no task has been generated with them.

The rules of study 1 carry over:
- the pilot may calibrate difficulty, by the ladder of section 7, and find broken tasks;
- it must not be used to choose anything after looking at which arm is ahead;
- later changes go in the Deviations section at the end, each with a date and a reason, and the
  frozen text is never edited.

## Decided by the maintainer (2026-11-18)

1. **Task source:** random CSS mutations on third-party open-source sites (section 4), not hand-picked
   regressions.
2. **Arms:** the pixel comparison (B) and TestivAI (C) only.
3. **A second test:** token use (H2), two-sided, with Holm's correction for the two tests (section 6).
4. **Model:** Claude Sonnet 5.5 only.
5. **Size:** 72 tasks × 2 arms × 3 repeats = 432 runs, raised by the power rule of section 6 if the
   pilot calls for it.

## Decided by the maintainer (2026-11-19)

After the build of sections 4 to 7, and the trial generations, the maintainer chose:

1. **The pixel filter:** a change is kept only when both arms' own checks flag it (section 4). The
   write-up also reports how many candidates each check alone would have caught.
2. **An even mix of classes:** each mutation's class comes from a per-site deck (section 4), not
   from a fresh draw per candidate.
3. **Drift:** full font hinting, as chosen by the rule (section 4).
4. **The gaps found in sections 6 and 7:**
   - no rung below the start: the maintainer decides if the pilot is below 40%;
   - "up to 120 tasks" counts S1 to S3;
   - H1 is supported when Holm's procedure rejects it.

## Seeds (written at the freeze, 2026-11-19)

Each seed is the freeze date with a two-digit purpose number. None has been used before: the trial
generations used seed 1.

| seed | value | what it decides |
| --- | --- | --- |
| `seeds.generation` | 2026111901 | the task set: the allocation of the 72 slots, and every draw of every task (`study2/generate-tasks.mjs`) |
| `seeds.pilot` | 2026111902 | the pilot's site, and its two tasks per stratum (`study2/runner/plan.mjs`) |
| `seeds.order` | 2026111903 | the order of the runs, in the pilot and in the full study |
| `seeds.extension` | 2026111904 | the extra tasks, only if section 6's power rule adds any |

The same values are in `study2/study.config.json`, and a test checks that the two agree. The
bootstrap's seed (1) and the site draw's (20261118) are as written in their sections.

## 1. Why a second study

Study 1 found no measurable difference between TestivAI and a plain pixel comparison: both solved
almost every task (`RESULTS.md`). Its tasks had one defect each, on a small site, written by TestivAI's
maker, and the pixel comparison was already enough. That leaves the question open for conditions where
a pixel comparison plausibly falls short:

- several defects at once;
- defects on longer, real-world pages;
- screenshots that differ for reasons that are not in the code (rendering drift between machines),
  with or without a real defect underneath.

Study 2 asks whether TestivAI helps there, with tasks no one chose by hand.

## 2. Question

Does a coding agent fix visual regressions more often with TestivAI than with a pixel comparison, when
the regressions are generated at random on real third-party sites and include several defects at once
and rendering noise?

## 3. Arms

- **Decided:** the same two arms as study 1, with the same tools, versions and instruction lines:
  - B: Playwright `toHaveScreenshot()` and its diff images;
  - C: TestivAI capture, MCP server and `results.json`.
- **Decided:** the no-tool arm A is dropped. Study 1 settled that having a visual tool helps; A would
  cost a third of the runs and does not bear on the question.

## 4. Tasks

**Sites.**

- **Pool:** the Start Bootstrap templates published on npm (`startbootstrap-*`, MIT licence, 39
  packages on 2026-11-18).
- **Drawn (2026-11-18):** heroic-features, agency, full-width-pics, bare, shop-item and small-business,
  each a one-page site. Three older packages were skipped on the way, because they ship no built page.
- **Eligibility:** a built page in the package; not an admin dashboard; renders offline once its
  remote fonts and scripts are removed. Remote resources are stripped the same way for every site,
  and both arms see the same files.
- **Selection:** 6 sites drawn at random from the eligible ones, before any task is generated. The
  candidates are the 39 names in `study2/sites/candidates.json` (taken 2026-11-18). They are tried in
  the order given by seed **20261118** (`selectionOrder` in `study2/sites.mjs`), and the first six
  eligible are kept. Each is pinned to the version and integrity hash it had when drawn.
- **Found at the draw (2026-11-18):** three of the six sites load placeholder images from
  other hosts (`dummyimage.com`, `source.unsplash.com`), which offline would show as broken.
  - **Why it matters:** TestivAI reports broken images as warnings and a pixel comparison does not, so
    this could draw arm C's agents into "fixing" images that are not part of the task.
  - **The rule:** the importer replaces every such image with a local SVG stand-in of the same size,
    made from its URL, the same way on every site.
  - **Not a new draw:** the eligibility rule was not changed after the draw, and the six sites stand.
  - **Check:** after the import, every site makes no remote request and no failed local request
    offline (`study2/sites/manifest.json`).
- **Used rules:** mutations are drawn only from CSS rules that are used: under the rule's `@media`,
  its selector, with pseudo-elements taken off, matches at least one element in a captured view
  (`study2/usage.mjs`). The page is loaded as the oracle loads it: each viewport, reduced motion,
  after its scripts run. On the six sites, 63 to 207 of about 2,300 to 2,500 rules are used.
- **Views:** each page at desktop (1280×800) and mobile (390×844) size, the oracle's two
  viewports. The six sites are one page each and have no states to reach, so each has two views.

**Mutations (the class deck decided 2026-11-19).** The rules are code
(`study2/mutate.mjs`, `study2/generate.mjs`); this is what the code does.

- **What a mutation is:** one change to one declaration in the site's own stylesheet, in place:
  - first a property class, from a published list: colour, background, font size, font weight,
    letter spacing, line height, margin, padding, width, display and flex, position and z-index,
    border, opacity, overflow, text transform. **The class comes from the site's deck:**
    - each site has the 15 classes in a seeded order, and each mutation takes the next class in
      that order that can serve it, so each class is used once per round;
    - when the deck is used up, a new round starts in a new seeded order;
    - a class with no declaration left on the site whose change shows is dead there, and skipped
      from then on;
  - then the class's candidates, the used rules' declarations that the class's rule can change,
    in a random order, one at a time until one shows (below);
  - then a new value by the class's fixed rule:
    - **lengths** (font size, letter spacing, line height, margin, padding, width, border): the
      first non-zero number scaled by 0.5 or 1.5 (even odds); a px value moves by at least 1px;
      values with `var()` or `calc()` are left out;
    - **colours** (colour, background): hue turned half-way round; a grey (saturation below 0.15),
      black or white has its lightness inverted instead; `var()` is left out;
    - **keywords:** font weight bold↔normal by a fixed table; text transform none↔uppercase;
      overflow hidden↔visible; opacity 0.5 or more → 0.3, else 1; z-index above 0 → −1, else 10;
      display, flex direction, justify content, align items, flex wrap and position: another value
      of the property, at random from a fixed list;
    - `!important` is kept.
  - **Custom properties:** one that holds a literal colour (`--bs-btn-bg: #0d6efd`), or an r, g, b
    triple under a name ending in `-rgb`, is a colour declaration. No other custom property is
    mutated.
- **Validity filters:** a mutation is kept only if both hold (`study2/validity.mjs`):
  - it changes at least one measured property of an element rendered before or after (a box of
    non-zero size, not clipped away, not `visibility: hidden`), or the page size, in a captured
    view, as the oracle's own capture measures it;
  - **both arms' own screenshot checks flag it**, each in at least one view, at their default
    settings (`study2/arm-checks.mjs`). Each is the code that arm runs, at the version it installs
    (a test pins both):
    - arm B, Playwright 1.63.0's `toHaveScreenshot` comparator: threshold 0.2, anti-aliased
      pixels skipped, any counted pixel fails;
    - arm C, TestivAI 2.7.2's pixel diff, called as its reporter calls it: threshold 0.1,
      anti-aliased pixels counted, a difference whose summed luminance is at most 0.5 × 256 read
      as identical.

    Neither check is more sensitive than the other in every case: a test shows a single pixel
    that Playwright flags and TestivAI does not, and thin lines can be the reverse.

  Otherwise the class's next candidate is tried, and when the class has none left, the next class.
  The filters look at the page and at the
  two pixel comparisons only: never at TestivAI's analysis (DOM diff, labels, verdicts), and never
  at any agent. Each site captures identically twice, in what is measured and in every pixel, which
  the filters need and a test checks.
- **Several mutations (S2):** on different rules, each showing on its own, and showing together;
  if they do not show together, the last is dropped and another drawn.
- **Who chooses:** the RNG chooses everything, with recorded seeds. No person picks, reviews or
  discards an individual task before the runs, except by these filters, which run as code.
- **Allocation:** one site order from the seed, dealt round-robin through the strata in turn, so
  each site gets 12 tasks and each stratum is spread as evenly as its count allows. Task ids are
  given in a seeded order that says nothing of the stratum. Each task draws from its own seeded
  stream. On a site, no declaration is mutated by two tasks.
- **The seed** for the real generation is `seeds.generation` (section "Seeds"), written before the
  generation runs.

**Trial generation (2026-11-18), disclosed.** The generator was run on the six sites with a
throwaway seed (1), to check that it works on them. Its tasks are not used and were not committed.
- **What it found, and changed:**
  - Bootstrap 5 keeps most colours in custom properties. On three of the six sites no colour or
    background declaration could be mutated, and on a fourth only one. Custom properties holding a
    colour were added to the colour class (above).
  - One kept mutation changed 128 pixels, but none at Playwright's default threshold. Arm B's check
    would pass on it while arm C's might not, a difference of default settings rather than of what
    the study measures. The pixel filter was first changed to B's threshold.
  - **That change rested on a wrong assumption, corrected the same day.** I had written that
    TestivAI's default is more sensitive than Playwright's. Reading both comparators showed
    otherwise:
    - Playwright skips anti-aliased pixels;
    - TestivAI counts them, but reads a difference whose summed luminance is small as none.

    The filter now asks each arm's own check, as above.
- **After these changes, the same seed:**
  - All 72 tasks were generated, from 228 candidates, of which 90 were kept, in about 4 minutes.
  - **Rejected by the arms' checks:** 3 of the 228 candidates.
    - Two were flagged by TestivAI's check and not by Playwright's: a button's border colour, and
      a form field's border radius. Both are thin lines, which Playwright's anti-aliasing
      detection is likely to skip.
    - One was flagged by neither: a toggler border at 10% opacity.
    - None was flagged by Playwright's check alone.
  - **What this means:** requiring both checks keeps the study on what TestivAI's analysis adds,
    given a difference both tools report. It leaves out the cases where its check catches what
    Playwright's misses.
  - **The alternative, either check, was not adopted** (decided 2026-11-19). It would measure
    detection as well, but mix in differences of default settings. The write-up reports how many
    real candidates each check alone would have caught.
  - **The kept mix was uneven.** Kept per class: line height 15, font size 12, margin 10,
    padding 10, display and flex 10, font weight 9, width 9, position and z-index 6, colour 3,
    background 3, border 2, text transform 1, letter spacing, opacity and overflow 0.
  - **Why:** the class was drawn afresh for each candidate, and classes differ in how often a
    change shows. Most colour candidates are palette entries nothing reads, and most overflow
    changes clip nothing.
- **Second trial (2026-11-19), with the class deck, the same throwaway seed (1):**
  - All 72 tasks were generated, from 249 candidates, of which 90 were kept, in about 7 minutes.
  - **Kept per class:** margin 11, width 11, display and flex 10, padding 10, colour 9,
    line height 9, font size 8, font weight 7, position and z-index 6, border 3, background 2,
    text transform 2, letter spacing 1, opacity 1, overflow 0. Perfectly even would be 6 each.
  - **What is left uneven comes from the sites:**
    - overflow can make no visible change on any of the six;
    - letter spacing and opacity can on one site each;
    - background and text transform can on two;
    - border can on three.

    The record of a generation lists the dead classes per site, and the write-up reports the real
    tasks' mix.
  - **S2:** 10 tasks with two mutations and 10 with three.
  - **Validation:** all 72 tasks pass it (`study2/validate-tasks.mjs`).
  - **Each arm's own visual test** (`--arms`) flags every one of the 72, in its real workspace.
    - In 64, both arms flag both views.
    - In 8 (S1 and S2), both arms flag one view: the change shows at one size only.
    - The two arms never disagreed on a task.

**Strata, 72 tasks:**

| stratum | what the agent starts from | tasks |
| --- | --- | --- |
| S1, one defect | one mutation | 20 |
| S2, several defects | two or three mutations (even odds) on different rules | 20 |
| S3, defect and drift | one mutation, and baselines recorded under a different rendering setting | 20 |
| S4, drift only (decoy) | no mutation, baselines recorded under a different rendering setting | 12 |

**Rendering drift (setting chosen 2026-11-18, `study2/drift.mjs`).**

- **What:** the S3 and S4 baselines are recorded under one setting that changes how text is drawn
  but no CSS, as a different machine's font setup does. Both arms' baselines are recorded under the
  same setting. The agent's own checks run under the machine's normal setting, so its first check
  shows the drift.
- **The list, in order,** committed before the search ran on the six sites:
  1. full font hinting (fontconfig);
  2. font anti-aliasing off (fontconfig);
  3. Chromium's `--disable-font-subpixel-positioning`;
  4. Chromium drawing through ANGLE's SwiftShader.
- **The rule:** the first setting under which every view of every site is flagged by both arms'
  checks, while the DOM and computed styles stay as they are. Geometry may move, since hinting
  changes how wide text is drawn.
- **Chosen:** full font hinting (`study2/drift.json`). All 12 views are flagged by both checks,
  with 8,749 to 312,185 pixels differing per view.
- **Changed from the first draft, disclosed:** the first draft named a Chromium setting that changes
  anti-aliasing or hinting. A look at two of the sites (agency, bare), before the list was set,
  showed:
  - Chromium's own hinting flags change nothing on this machine;
  - colour-profile flags change many pixels, by too little for arm B's check;
  - a change in anti-aliasing alone is skipped by arm B's check by design.

  The list was set after that look, and the search on all six sites ran after the list was
  committed.

**Prompt.** Every task gets the same prompt, which names no category: "The site looks
different since the last change. Can you take a look and fix it?"

**Validation.** Every task must pass, as code, before the pilot, like study 1's `npm run validate`
(`study2/validation.mjs`, `study2/validate-tasks.mjs --arms`):

- **the set:**
  - each stratum's count, drift flag and number of mutations;
  - unique ids;
  - no declaration mutated by two tasks on a site;
  - every mutation still where it was recorded in the stylesheet, with a new value;
- **each seeded task (S1 to S3):**
  - the seeded site fails the oracle;
  - reverting the seed passes it (so the clean site has no collateral);
  - the seed still shows to both arms' checks;
- **in S2:** each mutation shows on its own, and partial credit is 0 on the seeded site and full
  on the reverted one;
- **under drift (S3, S4):** the drift is pure (no DOM or computed-style change, every view
  flagged by both checks), and in S3 the seeded site differs from the drifted baselines for both
  arms;
- **each decoy (S4):** the clean site, captured again, passes as a decoy;
- **each task, in its real workspace:** each arm's own visual test flags it (`--arms`).

**If a generated task fails validation,** the set is not used. The failure is recorded as a dated
deviation, its cause is fixed in code (test first), and the set is generated again with the same
seed. No task is dropped or replaced by hand.

The 72 tasks of the trial generation (seed 1, not used) all pass it, in about 4 minutes.

## 5. Scoring

Decided by the oracle of study 1, generalised. No hand-written test per task is needed, since the
oracle measures what the seed changed.

- **S1 to S3:** success means:
  - every property the mutations changed is back as it was (`checkRestored`);
  - nothing else changed (`checkCollateral`);
  - nothing protected was changed (tampering, as in study 1).
- **What is judged (`study2/oracle.mjs`):**
  - the oracle's measurements of each view, with study 1's tolerances (0.5 px; 0.02 of the
    visible fraction);
  - the page itself always (title, size, fonts);
  - an element only when it is rendered on either side (a box of non-zero size, not clipped away,
    not hidden). Study 2 has no states to reach, so an element never rendered is never seen, and
    is neither required nor penalised. The validity filters use the same rule.
- **Any fix counts:** the oracle compares measurements, not files, so reverting the seed and
  overriding it elsewhere both pass. A test checks both on a drawn site, and checks that a fix
  with an unrelated change fails.
- **S4 (decoy):** success means no file under the site changed.
- **Partial credit, for S2:** the share of the mutations restored, reported beside the strict
  rate. A mutation counts as restored when all of its own changes (the clean site with that
  mutation alone) are back. Where two mutations change the same property, neither counts until
  both are restored there.
  - **Known limit, found while building the scorer:** on a one-page site, two layout mutations
    often move the same elements. Partial credit then counts neither until both are restored, so
    it can undercount a half-done fix. A test shows such a case. It is description only, and the
    write-up says so beside the numbers.

## 6. Outcomes and analysis

**Primary.**

- **What is compared:** success of C against B over S1 to S3 (60 tasks), paired by task.
- **Interval:** a percentile bootstrap over tasks (10,000 resamples, seed 1).
- **H1:** C is higher than B. It is supported if the one-sided 95% lower bound lies above 0.
- **Kill line:** if C − B is under 10 points, or its one-sided interval reaches 0, the write-up says
  that TestivAI did not measurably help over a pixel comparison in study 2 either.

**Second test (Decided).**

- **H2:** C and B differ in tokens per run on S1 to S3: the per-task median, on a log scale, paired.
- **Direction:** two-sided, since study 1 found C using about a third more tokens.
- **Correction:** with two tests, Holm's correction at 5% overall.
- **How the two fit together (`study2/analysis.mjs`):**
  - Each test's p-value comes from the same bootstrap as its interval (over tasks, 10,000
    resamples, seed 1):
    - H1, one-sided: the share of resampled means at or below 0;
    - H2, two-sided: twice the smaller tail.
  - Holm's procedure compares the smaller p-value with 2.5%, then the other with 5%.
  - **H1 is supported when Holm rejects it.** That is the draft's "one-sided lower bound above 0",
    taken at the level Holm assigns: 97.5% if H1 has the smaller p-value, 95% otherwise. A test
    checks that the 95% bound and the p-value agree.
  - The kill line is unchanged.
  - **H2** is reported as the ratio of C's tokens to B's, the per-task median taken first, with its
    interval.

**Description only.**

- each stratum on its own, and the decoys;
- turns, agent time and cost;
- false "done";
- partial credit in S2;
- the tasks where B beat C, listed as prominently as the reverse.

**What the design can detect.**

- **The deciding quantity is the per-task spread of C − B,** which the pilot measures. With 60 tasks:

  | per-task SD of C − B | one-sided margin | power for a true 10-point difference |
  | --- | --- | --- |
  | 0.2 | 4 points | 99% |
  | 0.3 | 6 points | 83% |
  | 0.4 | 9 points | 61% |

- **If the pilot's spread implies less than 80% power,** the task count is raised before the full
  study, by a rule fixed here: add tasks to S1 to S3 equally until the estimate reaches 80%, up to
  120 tasks.
- **How extra tasks are made:**
  - a second generation, with `seeds.extension`, fills only the added slots;
  - the slots are dealt over the sites round-robin, as the first set's are;
  - it never mutates a declaration the first set mutates;
  - the first set, the pilot's tasks included, stays as it is.

  That code is built only if the rule fires, test first, before the full study.

## 7. The pilot and difficulty calibration

**The pilot:** one site, 8 tasks (2 per stratum), B and C, 3 repeats each: 48 runs. They are drawn
with `seeds.pilot` from the generated set, and stay in the full study, as in study 1.

- **The calibration is arm-blind.** A script reports only the pooled success of B and C together on S1
  to S3.
- **If the pooled success is above 85%,** tasks get harder by a fixed ladder, one rung at a time, and
  the pilot runs again:
  1. two mutations per S1 task, three in S2;
  2. smaller value changes (scale 0.8 or 1.2);
  3. mutations only on elements below the first screen.
- **If it is below 40%,** the ladder goes the other way.
- **When a rung changes the tasks,** the whole set is generated again with `seeds.generation` under
  the rung's rules, validated again, and the pilot runs again on its tasks.
- **The pilot's per-arm results** are not computed until the full study's task set and size are final,
  after the ladder and the power rule.
- **The pilot also measures** cost per run, and the per-task spread for section 6.
- **As built (`study2/calibration.mjs`, `study2/calibrate.mjs`):**
  - The script reports the pooled rate, the decision and the next rung, the median cost per run,
    and the SD of the per-task C − B difference over S1 to S3.
  - It never computes a per-arm rate or the mean difference. A test checks that swapping the arms'
    labels changes nothing in what it returns. The SD is the one quantity that uses the arms
    separately, and it does not say which arm did better.
  - From the SD, it gives the power at 60 tasks and the task count by section 6's rule.
- **Gaps found while building (decided 2026-11-19):**
  - The ladder has no rung below the start. If the pilot at the start is below 40%, the script
    says so and the maintainer decides; it does not invent an easier rung.
  - "Up to 120 tasks" is read as the S1 to S3 count, raised in steps of three (one per stratum).
    The 12 decoys stay as they are.
  - The rungs are not built into the generator. They are built only if the pilot calls for one,
    test first, before that pilot runs again.

## 8. Runs

- **Decided:** Claude Sonnet 5.5 in Claude Code 2.1.322, the locked-down harness and isolation of
  study 1 unchanged. The probe must pass before the pilot and before the full run.
- **Size:** 72 tasks × 2 arms × 3 repeats = 432 runs, in a seeded random order. At study 1's pace,
  that is about 6 to 8 hours on the subscription.
- **Errors:** retried once; double errors excluded and listed, with a flag above 5%.
- **Decided:** Opus 5.5 is not run.

## 9. Known limits, to be stated in the write-up

- **Generated defects are not real ones.** They are CSS changes at random, not the regressions
  developers make. They are unbiased in a way hand-written tasks are not, but less realistic.
- **The mutation operators and the strata were designed by TestivAI's maker.** The sites and the
  individual tasks are chosen at random; the menu they are drawn from is not.
- **S3 and S4 test a case TestivAI was built for.** It labels pixel differences with identical DOM and
  styles as likely render noise. A difference there is expected by design and is reported per stratum,
  apart from S1 and S2.
- **One model and one agent.**
- **Static sites only:** no dynamic content, no JavaScript-driven layout.

## 10. What has to be built

The order, with what is built so far:

1. **Site import:** fetch, strip remote resources, check that it renders offline. *Built:*
   `study2/sites.mjs`, `study2/select-sites.mjs`.
2. **Mutation generator and validity filters,** with tests. *Built:* `study2/css.mjs`,
   `study2/usage.mjs`, `study2/mutate.mjs`, `study2/validity.mjs`, `study2/generate.mjs`,
   `study2/generate-tasks.mjs`; the oracle's capture takes a page by file name and can screenshot
   each view.
3. **Views per site, and the generalised oracle:** restore and collateral without hand-written tests.
   *Built:* `study2/oracle.mjs` (scope, judge, partial credit); views in `study2/validity.mjs`.
4. **Drifted baselines** for B and C, with the setting search. *Built:* the search
   (`study2/drift.mjs`, `study2/choose-drift.mjs`, result in `study2/drift.json`). Recording each
   arm's baselines under it is part of the runner integration.
5. **Per-task validation,** as code. *Built:* `study2/validation.mjs`, `study2/validate-tasks.mjs`.
6. **The calibration script,** pooled only. *Built:* `study2/calibration.mjs`, `study2/calibrate.mjs`.
7. **Analysis by stratum,** H2, and partial credit. *Built:* `study2/analysis.mjs`,
   `study2/analyze.mjs`, on top of study 1's analysis. It prints JSON. A markdown summary like study
   1's is not built yet: it is needed for the write-up, not before the pilot.
8. **The runner integration.** *Built:* `study2/runner/`, through study 1's runner with `--study 2`
   (`RUNNING.md`, "Study 2"):
   - **Each site as the agent's app:** the site, a server that serves every file as the oracle's
     server does, and each arm's files. These are study 1's packages and Playwright config (without
     the functional tests), study 1's visual test for the site's one page, and study 1's
     instruction lines. Tests pin each against study 1's.
   - **Templates per site, arm and baselines:** drifted ones are recorded under the chosen font
     setting. The build refuses a drifted template unless the arm's own test, run as the agent
     runs it, flags every view.
   - **The workspace:** the task's mutations in the stylesheet, one commit, and study 1's
     workspace checks.
   - **The scorer:** restore and collateral by measurement (S1 to S3), the file rule (S4), partial
     credit (S2), and tampering as in study 1. Every measurement of the benchmark's own site is
     taken before any agent runs.
   - **The plans:** the pilot is one site drawn by a seed, then two tasks of each stratum from it;
     the full study is every task. Both are in a seeded order, with seeds left unset until the
     freeze.
   - **The validation checks each arm's own test, too:** `validate-tasks --arms` runs it in every
     task's real workspace, where the filter had used the arms' comparators on the oracle's
     screenshots.
   - **End to end with the fake agent:** every outcome, as study 1's runner test checks them. Study
     1's runner tests pass unchanged.

**Before the pilot:**
- the seeds are written (section "Seeds"), and this file is frozen and tagged `study2-prereg-v1`;
- generate the task set with `seeds.generation` and validate it with `--arms`;
- run the probe.

Each step is test first. The probe and the isolation stay as they are.

## Deviations

### 2026-11-24, after the full study

**No deviation in how the study was run or tested.**

- **The runs:** the 432 runs ran as planned, at rung 1, with no errors.
- **The tests:** H1, H2, Holm's correction and the kill line come from `study2/analysis.mjs` as
  frozen.

**Added after the results were seen, all description:**

- **None of it changes H1, H2 or their numbers.** A check confirms they are identical with and
  without it.
- **The markdown summary** (`study2/summary.mjs`): section 10 left it to be built for the write-up.
- **Description beyond the tests** (`study2/describe.mjs`):
  - H2's token measure in each stratum on its own;
  - the pilot's own measures, pooled success and the per-task SD of C − B, taken on the full study;
  - how many drawn candidates each arm's comparator flags;
  - a note on how many points B's rate leaves C.
- **The analysis reads the transcripts again** (`study2/analyze.mjs`), as study 1's analysis does.
  That covers turns, the done claim, agent time and the shortcut flags; success and tokens do not
  come from the transcript.
- **The shortcut flag `update_snapshots`, corrected test first.** It had counted `sort -u` after a
  pipe as Playwright's `-u`: 16 runs were flagged, and none had updated a snapshot.

**Not a rule of this plan, but recorded:** during the full study, the assistant that ran it meant to
count only runs and errors. One log check showed the outcomes of runs 121 to 124. Nothing was decided
after it.
