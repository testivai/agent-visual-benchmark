// Study 2's oracle (study2/PREREGISTRATION.md, section 5): study 1's restore and
// collateral checks, with the scope taken from measurements alone. What the seed
// changed on rendered elements must be back as it was; nothing else rendered may
// change. No test is written by hand for a task.
import { diffSnapshots, checkRestored, checkCollateral } from '../oracle/lib/compare.mjs';

// A box of non-zero size, not clipped away, not hidden.
export const isRendered = (e) => Boolean(e) && e.w > 0 && e.h > 0 && e.vis > 0 && e.visibility !== 'hidden';

const elementOf = (snapshot, view, key) => snapshot.views[view]?.elements?.[key];

// The page itself is always judged; an element only when it is rendered on either side.
// Study 2 has no states to reach, so an element never rendered is never seen.
function judged(a, b, entry) {
  const [view, key] = entry.split('|');
  if (key.startsWith('@')) return true;
  return isRendered(elementOf(a, view, key)) || isRendered(elementOf(b, view, key));
}

// What must be restored, and what is free to differ while it is: the seed's judged changes.
export function scopeOf(clean, seeded) {
  const entries = diffSnapshots(clean, seeded).filter((entry) => judged(clean, seeded, entry));
  return { type: 'fix', mustRestore: new Set(entries), free: new Set(entries) };
}

// A decoy (nothing seeded) passes it by changing nothing rendered.
export function judge({ clean, seeded, actual }) {
  const scope = scopeOf(clean, seeded);
  const notRestored = checkRestored(clean, actual, scope);
  const collateral = checkCollateral(clean, actual, scope).filter((v) => judged(clean, actual, v.entry));
  return { success: notRestored.length === 0 && collateral.length === 0, notRestored, collateral };
}

// For several mutations: which ones have all their own changes restored.
// singles[i] is the clean site with mutation i alone. Where two mutations
// change the same property, neither counts until both are restored there.
export function partialCredit({ clean, singles, actual }) {
  const each = singles.map((single) => checkRestored(clean, actual, scopeOf(clean, single)).length === 0);
  const restored = each.filter(Boolean).length;
  return { restored, of: singles.length, share: singles.length === 0 ? null : restored / singles.length, each };
}
