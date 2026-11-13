# The pilots' isolation breach

Found on 2026-11-13, after the three pilots, while checking the DeepSeek pilot's shortcut flags. The pilots are not used in the
final analysis (PREREGISTRATION.md, section 5), but their success rates were meant to say which tasks
can tell the arms apart, and some of the DeepSeek pilot's were changed by this.

## What was wrong

The sandbox that every agent's Bash runs in blocked reading one directory: the one that holds the
benchmark (`/home/user`). Everything else on the machine was readable, and three things in it should
not have been:

1. **Leftover template folders** in `/tmp` (`/tmp/avb-template-*`, five of them, from 11 November).
   A template build that failed during development left its working folder behind
   (`runner/templates.mjs` removed it only on success). Each holds a copy of the app *as it was on 11
   November*, not the seeded one, so it holds the answer to every fix task and, for the fonts, a file
   that differs from today's. Some also hold arm C's TestivAI baselines and reports.
2. **The scratch folder of the session that ran the study** (`/tmp/claude-0/.../scratchpad`). Among
   its files: `probe/`, the font files made while writing the tasks (including the original and the
   re-exported font behind the decoy t19).
3. **`/root/.claude`**, where that session's own transcript is kept.

Leftover test folders (`/tmp/avb-results-*`, `-state-*`, `-cli-*`) were readable too; no agent opened
one. The benchmark itself, `/home/user`, stayed unreadable throughout.

The Phase 0 probe checked that the benchmark's answer files could not be read and that the web was
blocked. It did not check the rest of the machine. That was the gap.

## Which runs it touched

Every tool call of every run was scanned for paths outside the run's own folder
(`/tmp/avb-<run>`): other `/tmp/avb-*` folders, the scratch folder, `/root`, `/home`, `/proc/<pid>`.

**Sonnet 5.5: none of 54 runs.**

**Opus 5.5: 2 of 54 saw names only.** pilot-015 and pilot-021 (t19, arm C) searched the whole disk for
the font's name (`find / -iname "*acme-sans*"`), which listed template and scratch-folder paths. Neither
opened them. Both left the site unchanged and succeeded.

**DeepSeek-V4.1-Flash: 9 of 54 runs used what they found, and 1 more saw it.** This pilot is kept, as
it ran, in `results/deepseek/pilot-leaked/`, and was run again after the fix (below).

| run | task / arm | what it did | outcome |
| --- | --- | --- | --- |
| pilot-039 | t15 / A | diffed its stylesheet against a template's, made the site match | success, from the leak |
| pilot-052 | t15 / A | the same | success, from the leak |
| pilot-009 | t19 / A (decoy) | compared its site and font with the templates' | failure |
| pilot-045 | t19 / A (decoy) | copied a template's font into the site | failure, from the leak |
| pilot-054 | t19 / A (decoy) | grepped `/root`, which showed 2 KB of the study session's transcript (an example `package.json` and Playwright config); copied a template's font into the site | failure, from the leak |
| pilot-051 | t19 / B (decoy) | copied a template's font into the site | failure, from the leak |
| pilot-053 | t19 / B (decoy) | copied a template's font into the site | failure, from the leak |
| pilot-021 | t19 / C (decoy) | compared fonts with the templates' and the scratch folder's; copied a template's font | failure, from the leak |
| pilot-032 | t19 / C (decoy) | copied the scratch folder's original font into the site | failure, from the leak |
| pilot-047 | t15 / A | searched the disk, saw the templates' names, did not open them | failure |

Runs pilot-001, -024 and -038 searched `/tmp` only for their own screenshots and are not counted.

So in the DeepSeek pilot, the decoy's results (A 0/3, B 1/3, C 1/3) come from the leak, and two of
arm A's t15 successes do too. The other tasks' results are not affected.

## What changed before any further run

Made on 2026-11-13 and listed in `CHANGES_AFTER_PILOT.md`:

- **Closed directories.** The directory that holds the benchmark, the home directory and the system's
  temporary directory are closed to Bash (the sandbox) and to the Read and Edit tools (permission
  rules). `runner/claude.mjs`, `closedRoots`.
- **Read and Edit only in the run's own directory.** They were allowed everywhere; now only inside it,
  and in `dontAsk` mode anything else is denied.
- **Run directories outside the temporary directory.** Runs live in `/var/tmp/avb-runs/` (or
  `AVB_RUN_ROOT`), which the sandbox closes but for the run's own directory. Each names the process
  that owns it, and one whose owner is gone is removed before the next run (`runner/rundir.mjs`).
- **What a run must read stays readable:** the browsers, Node, and the proxy's CA bundle (in `/root`).
- **A failed template build removes its folder** (`runner/tempdir.mjs`).
- **Shortcut flags** also catch shell commands that read outside the workspace and its TMPDIR, and
  searches of the disk; the analysis reads them again from each transcript.
- **The leftover folders were deleted.**
- **The probe tries every way out the pilots found.** It plants a random secret in the temporary
  directory and one beside the run's directory, and asks the agent to read them with Bash and with
  the Read tool and to list `/tmp` and `/root`. It fails if a secret comes back, or if the run no longer
  works (tests, registry, CA bundle). On DeepSeek through the pinned Claude Code, 2026-11-13: both
  secrets "No such file", `/tmp` empty, `/root` showing only the CA bundle's folder, the Read tool
  denied, the tests passing, the registry reachable. PASS (`results/probe/probe.jsonl`).
