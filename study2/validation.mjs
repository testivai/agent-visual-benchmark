// Study 2's per-task validation (study2/PREREGISTRATION.md, section 4), as
// code, like study 1's `npm run validate`. Every task must pass before the
// freeze:
// - the set: the strata's counts, drift flags and mutation counts, unique ids,
//   no declaration mutated by two tasks on a site, and every mutation still
//   where it was recorded in the stylesheet;
// - each task: the seeded site fails the oracle, reverting the seed passes it
//   (so the clean site has no collateral), the seed still shows to both arms,
//   and in S2 each mutation shows on its own; under drift, the drift is pure
//   and the starting site differs from the drifted baselines for both arms.
import fs from 'node:fs';
import path from 'node:path';
import { STRATA, reasonOf } from './generate.mjs';
import { parseRules } from './css.mjs';
import { applyMutations } from './mutate.mjs';
import { judge, partialCredit } from './oracle.mjs';
import { captureSite, effectOf, shows, flaggedByB, flaggedByC, siteViews } from './validity.mjs';
import { driftProblems } from './drift.mjs';
import { withTempDir } from '../runner/tempdir.mjs';

// --- the set ------------------------------------------------------------------

function idProblems(tasks) {
  const seen = new Map();
  for (const t of tasks) seen.set(t.id, (seen.get(t.id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id, n]) => `ids: ${id} appears ${n} times`);
}

function mutationProblem(m, css, rules) {
  const where = `${rules[m.ruleId]?.selector ?? `rule ${m.ruleId}`} ${m.property}`;
  const now = css.slice(m.valueStart, m.valueEnd);
  if (now !== m.from) return `${where} is "${now}" in the stylesheet, not "${m.from}" as recorded`;
  return m.to === m.from ? `${where} is "${m.from}" before and after` : null;
}

function shapeProblems(t, strata, css, rules) {
  const s = strata[t.stratum];
  if (!s) return [`unknown stratum ${t.stratum}`];
  const n = t.mutations.length;
  const out = [];
  if (!s.counts.includes(n)) out.push(`${n} mutation${n === 1 ? '' : 's'}, ${t.stratum} has ${s.counts.join(' or ')}`);
  if (t.drift !== s.drift) out.push(`drift ${t.drift}, ${t.stratum} has drift ${s.drift}`);
  const ruleIds = t.mutations.map((m) => m.ruleId);
  for (const id of new Set(ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i))) out.push(`two mutations on one rule (${id})`);
  for (const m of t.mutations) out.push(mutationProblem(m, css, rules));
  return out.filter(Boolean);
}

function reuseProblems(tasks) {
  const bySite = new Map();
  for (const t of tasks) {
    if (!bySite.has(t.site)) bySite.set(t.site, new Map());
    const starts = bySite.get(t.site);
    for (const m of t.mutations) starts.set(m.valueStart, [...(starts.get(m.valueStart) ?? []), t.id]);
  }
  return [...bySite].flatMap(([site, starts]) => [...starts].filter(([, ids]) => ids.length > 1)
    .map(([start, ids]) => `${site}: the declaration at ${start} is mutated by more than one task (${ids.join(', ')})`));
}

function countProblems(tasks, strata) {
  return Object.entries(strata).map(([k, s]) => {
    const n = tasks.filter((t) => t.stratum === k).length;
    return n === s.tasks ? null : `${k}: ${n} tasks, not ${s.tasks}`;
  }).filter(Boolean);
}

// css: { site: the site's stylesheet as it is now }.
export function setProblems(tasks, { strata = STRATA, css }) {
  const rules = new Map(Object.entries(css).map(([site, text]) => [site, parseRules(text)]));
  return [
    ...idProblems(tasks),
    ...tasks.flatMap((t) => shapeProblems(t, strata, css[t.site], rules.get(t.site)).map((p) => `${t.id}: ${p}`)),
    ...reuseProblems(tasks),
    ...countProblems(tasks, strata),
  ];
}

// --- each task ----------------------------------------------------------------

function measurer(browser, { siteDir, cssFile, views }) {
  const css = fs.readFileSync(path.join(siteDir, cssFile), 'utf8');
  return (mutations) => withTempDir('avb-s2-validate-', async (dir) => {
    fs.cpSync(siteDir, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, cssFile), applyMutations(css, mutations));
    return captureSite(browser, dir, views);
  });
}

async function singlesProblems(task, measure, { clean, seeded, again }) {
  const singles = [];
  const out = [];
  for (const [i, m] of task.mutations.entries()) {
    const single = await measure([m]);
    const effect = effectOf(clean, single);
    if (!shows(effect)) out.push(`mutation ${i + 1} (${m.selector} ${m.property}) does not show on its own (${reasonOf(effect)})`);
    singles.push(single);
  }
  if (out.length > 0) return out;
  const before = partialCredit({ clean, singles, actual: seeded });
  const after = partialCredit({ clean, singles, actual: again });
  if (before.restored !== 0) out.push(`partial credit on the seeded site is ${before.restored} of ${before.of}, not 0`);
  if (after.restored !== after.of) out.push(`partial credit on the reverted site is ${after.restored} of ${after.of}, not all`);
  return out;
}

async function seedProblems(task, measure, { clean, again, drifted }) {
  const seeded = await measure(task.mutations);
  const out = [];
  if (judge({ clean, seeded, actual: seeded }).success) out.push('the seeded site passes the oracle');
  const reverted = judge({ clean, seeded, actual: again });
  if (!reverted.success) out.push(`reverting the seed does not pass the oracle (${[...reverted.notRestored, ...reverted.collateral].slice(0, 3).map((v) => v.entry).join(', ')})`);
  const effect = effectOf(clean, seeded);
  if (!shows(effect)) out.push(`the seed no longer shows (${reasonOf(effect)})`);
  if (task.mutations.length > 1) out.push(...await singlesProblems(task, measure, { clean, seeded, again }));
  if (task.drift) {
    const start = effectOf(drifted, seeded);
    if (!flaggedByB(start) || !flaggedByC(start)) out.push('the seeded site does not differ from the drifted baselines for both arms');
  }
  return out;
}

// clean: the clean site captured; drifted: the clean site captured under the
// drift setting (the S3 and S4 baselines).
export async function taskProblems(browser, { task, siteDir, cssFile, pages, clean, drifted }) {
  const views = siteViews(pages);
  const measure = measurer(browser, { siteDir, cssFile, views });
  const again = await measure([]);
  const out = [];
  if (task.mutations.length === 0) {
    const decoy = judge({ clean, seeded: clean, actual: again });
    if (!decoy.success) out.push(`the clean site, captured again, does not pass as a decoy (${decoy.collateral.slice(0, 3).map((v) => v.entry).join(', ')})`);
  } else {
    out.push(...await seedProblems(task, measure, { clean, again, drifted }));
  }
  if (task.drift) out.push(...driftProblems(clean, drifted, effectOf(clean, drifted).pixels).map((p) => `drift: ${p}`));
  return out.map((p) => `${task.id}: ${p}`);
}
