// Study 2's tasks (study2/PREREGISTRATION.md, section 4): the 72 slots spread
// over the sites by a seed, then for each slot mutations drawn until they pass
// the validity filters. The check is passed in, so the draw itself can be tested
// without a browser; siteChecker is the real one.
import fs from 'node:fs';
import path from 'node:path';
import { parseRules } from './css.mjs';
import { drawMutations, applyMutations } from './mutate.mjs';
import { usedRules } from './usage.mjs';
import { shows, siteViews, captureSite, mutationEffect } from './validity.mjs';
import { mulberry32, shuffle } from '../runner/rng.mjs';

export const STRATA = {
  S1: { tasks: 20, drift: false, mutations: () => 1 },
  S2: { tasks: 20, drift: false, mutations: (random) => (random() < 0.5 ? 2 : 3) },
  S3: { tasks: 20, drift: true, mutations: () => 1 },
  S4: { tasks: 12, drift: true, mutations: () => 0 },
};

const nextSeed = (random) => Math.floor(random() * 2 ** 32);

// One site order from the seed, dealt round-robin through the strata in turn,
// so each stratum and each site's total are as even as the counts allow. The
// ids are then given in a seeded order, so an id says nothing of its stratum.
export function allocate(strata, sites, seed) {
  const random = mulberry32(seed);
  const order = shuffle(sites, nextSeed(random));
  const slots = [];
  for (const [stratum, s] of Object.entries(strata)) {
    for (let i = 0; i < s.tasks; i++) slots.push({ stratum, site: order[slots.length % order.length] });
  }
  const idOrder = shuffle(slots.map((_, i) => i), nextSeed(random));
  return idOrder.map((slot, k) => ({ id: `s2t${String(k + 1).padStart(2, '0')}`, ...slots[slot] }));
}

export function reasonOf(effect) {
  if (effect.errors.length > 0) return 'a view could not be captured';
  if (effect.measured.length === 0) return 'no measured change on a rendered element';
  return 'no pixel changed';
}

const brief = (m) => ({
  ruleId: m.ruleId, selector: m.selector, media: m.media, class: m.class, property: m.property, from: m.from, to: m.to, valueStart: m.valueStart,
});

const summary = (effect) => ({
  measured: effect.measured.length,
  elements: new Set(effect.measured.map((e) => e.split('|').slice(0, 2).join('|'))).size,
  pixels: effect.pixels,
});

const MAX_CANDIDATES = 100;

// One candidate, kept if it shows on its own. A candidate that does not show
// can be drawn again later: the rule is only "otherwise another is drawn".
async function drawOne(ctx, state) {
  if (state.tries >= ctx.maxCandidates) throw new Error(`no mutation that shows after ${ctx.maxCandidates} candidates`);
  state.tries += 1;
  const taken = new Set(state.kept.map((m) => m.ruleId));
  const free = new Set([...ctx.used].filter((id) => !taken.has(id)));
  const [m] = drawMutations(ctx.rules, free, ctx.random, 1, { skip: state.skip });
  if (!m) throw new Error(`no mutation that shows after ${state.tries} candidates: nothing left to draw`);
  const effect = await ctx.check([m]);
  if (shows(effect)) state.kept.push({ ...m, effect: summary(effect) });
  else state.rejected.push({ ...brief(m), reason: reasonOf(effect) });
}

// Several mutations must also show together; if not, the last is dropped for good.
async function checkTogether(ctx, state) {
  const effect = await ctx.check(state.kept);
  if (shows(effect)) {
    state.together = summary(effect);
    return;
  }
  const dropped = state.kept.pop();
  state.rejected.push({ ...brief(dropped), reason: 'does not show together with the others' });
  state.skip.add(dropped.valueStart);
}

// count mutations on different rules, each showing on its own, and together.
// check(mutations) -> effect (see validity.mjs).
export async function drawTask({ rules, used, count, random, skip, check, maxCandidates = MAX_CANDIDATES }) {
  const ctx = { rules, used, random, check, maxCandidates };
  const state = { kept: [], rejected: [], tries: 0, skip: new Set(skip), together: null };
  while (state.kept.length < count) {
    await drawOne(ctx, state);
    if (state.kept.length === count && count > 1) await checkTogether(ctx, state);
  }
  return { mutations: state.kept, together: state.together, rejected: state.rejected };
}

const taskSeed = (seed, index) => (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
const NONE = { mutations: [], together: null, rejected: [] };

// sites: { name: { rules, used } }; check(siteName, mutations) -> effect.
// Each task draws from its own seeded stream; on a site, a declaration mutated
// by one task is never mutated by another.
export async function generateTasks({ sites, strata = STRATA, seed, check }) {
  const slots = allocate(strata, Object.keys(sites), seed);
  const mutated = Object.fromEntries(Object.keys(sites).map((name) => [name, new Set()]));
  const tasks = [];
  for (const [index, slot] of slots.entries()) {
    const random = mulberry32(taskSeed(seed, index));
    const count = strata[slot.stratum].mutations(random);
    const site = sites[slot.site];
    const drawn = count === 0 ? NONE : await drawTask({
      rules: site.rules, used: site.used, count, random, skip: mutated[slot.site], check: (ms) => check(slot.site, ms),
    });
    for (const m of drawn.mutations) mutated[slot.site].add(m.valueStart);
    tasks.push({ ...slot, drift: strata[slot.stratum].drift, ...drawn });
  }
  return { seed, tasks };
}

// The real check for one site: its rules, the rules its pages use, and the
// effect of a set of mutations against the clean site, remembered per set.
export async function siteChecker(browser, { siteDir, cssFile, pages }) {
  const css = fs.readFileSync(path.join(siteDir, cssFile), 'utf8');
  const rules = parseRules(css);
  const views = siteViews(pages);
  const { used } = await usedRules(browser, siteDir, rules, { pages });
  const clean = await captureSite(browser, siteDir, views);
  const cache = new Map();
  const check = async (mutations) => {
    const key = mutations.map((m) => `${m.valueStart}:${m.to}`).sort().join('|');
    if (!cache.has(key)) cache.set(key, await mutationEffect(browser, { siteDir, cssFile, css: applyMutations(css, mutations), views, clean }));
    return cache.get(key);
  };
  return { rules, used, check };
}

// Per class, how many mutations were kept and how many candidates were rejected, by reason.
export function drawStats(tasks) {
  const byClass = {};
  const entry = (cls) => (byClass[cls] ??= { kept: 0, rejected: {} });
  let kept = 0;
  let rejected = 0;
  for (const t of tasks) {
    for (const m of t.mutations) {
      entry(m.class).kept += 1;
      kept += 1;
    }
    for (const r of t.rejected) {
      const e = entry(r.class);
      e.rejected[r.reason] = (e.rejected[r.reason] ?? 0) + 1;
      rejected += 1;
    }
  }
  const sorted = Object.fromEntries(Object.keys(byClass).sort().map((k) => [k, byClass[k]]));
  return { candidates: kept + rejected, kept, byClass: sorted };
}
