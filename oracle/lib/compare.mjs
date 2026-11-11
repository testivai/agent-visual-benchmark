// Compares two measurements of the site (see capture.mjs for what is measured)
// and works out, per task, what the task was allowed to change.
//
// A difference is written "view|key|field", e.g. "pricing@desktop|.btn[2]|color".
// Special keys: "@doc" (the page), "@view" (the view could not be reached).
// Special fields: "@exists" (the element is gone), "@extra" (it is new).
// In a set of free entries, "view|key|*" frees every field of that element.

export const TOLERANCE = { default: 0.5, vis: 0.02 };
const POSITION_FIELDS = new Set(['x', 'y']);
const WHOLE_ELEMENT = new Set(['@exists', '@extra']);

export const familyOf = (key) => key.replace(/\[\d+\]$/, '');
const parse = (entry) => {
  const [view, key, field] = entry.split('|');
  return { view, key, field };
};

function same(field, a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= (TOLERANCE[field] ?? TOLERANCE.default);
  }
  return a === b;
}

function diffFields(prefix, a, b, out) {
  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!same(field, a[field], b[field])) out.push(`${prefix}|${field}`);
  }
}

function diffView(id, a, b, out) {
  if (!a || !b) {
    out.push(`${id}|@view|@exists`);
    return;
  }
  if (a.error || b.error) {
    if (a.error !== b.error) out.push(`${id}|@view|error`);
    return;
  }
  diffFields(`${id}|@doc`, a.doc, b.doc, out);
  for (const key of new Set([...Object.keys(a.elements), ...Object.keys(b.elements)])) {
    if (!(key in b.elements)) out.push(`${id}|${key}|@exists`);
    else if (!(key in a.elements)) out.push(`${id}|${key}|@extra`);
    else diffFields(`${id}|${key}`, a.elements[key], b.elements[key], out);
  }
}

export function diffSnapshots(a, b) {
  const out = [];
  for (const id of new Set([...Object.keys(a.views), ...Object.keys(b.views)])) {
    diffView(id, a.views[id], b.views[id], out);
  }
  return out.sort();
}

// What a solution restyles (or adds, or removes) is free as a whole element;
// what it only moves is free in position only.
function expand(entries) {
  const byElement = new Map();
  for (const entry of entries) {
    const { view, key, field } = parse(entry);
    const id = `${view}|${key}`;
    if (!byElement.has(id)) byElement.set(id, []);
    byElement.get(id).push(field);
  }
  const out = new Set();
  for (const [id, fields] of byElement) {
    const elementLevel = !id.endsWith('|@doc') && !id.endsWith('|@view')
      && fields.some((f) => WHOLE_ELEMENT.has(f) || !POSITION_FIELDS.has(f));
    if (elementLevel) out.add(`${id}|*`);
    else for (const f of fields) out.add(`${id}|${f}`);
  }
  return out;
}

const isFree = (free, entry) => {
  const { view, key } = parse(entry);
  return free.has(entry) || free.has(`${view}|${key}|*`);
};

// type      'fix' | 'change' | 'decoy'
// clean     the clean app
// seeded    clean + seed.patch
// solutions [reference, ...accepted alternatives], each measured after it is applied
export function buildScope({ type, clean, seeded, solutions }) {
  const seedDiff = diffSnapshots(clean, seeded);
  const solutionDiffs = solutions.map((s) => diffSnapshots(clean, s));
  if (type === 'fix') {
    if (solutionDiffs[0].length > 0) {
      throw new Error(
        `the reference fix does not restore the clean app: ${solutionDiffs[0].slice(0, 12).join(', ')}`
        + `${solutionDiffs[0].length > 12 ? ` and ${solutionDiffs[0].length - 12} more` : ''}`,
      );
    }
    const tolerated = new Set(solutionDiffs.flat());
    return {
      type,
      mustRestore: new Set(seedDiff.filter((e) => !tolerated.has(e))),
      free: new Set([...seedDiff, ...tolerated]),
    };
  }
  if (type === 'change') {
    return { type, mustRestore: new Set(), free: expand([...seedDiff, ...solutionDiffs.flat()]) };
  }
  return { type, mustRestore: new Set(), free: new Set(seedDiff) };
}

function valueAt(snapshot, { view, key, field }) {
  const v = snapshot.views[view];
  if (!v) return undefined;
  if (key === '@view') return field === 'error' ? v.error : 'present';
  if (v.error) return undefined;
  if (key === '@doc') return v.doc[field];
  const el = v.elements[key];
  if (field === '@exists' || field === '@extra') return el ? 'present' : 'absent';
  return el?.[field];
}

const violation = (entry, clean, actual) => ({
  entry,
  expected: valueAt(clean, parse(entry)),
  actual: valueAt(actual, parse(entry)),
});

function restoredElement(clean, actual, { view, key }) {
  const want = clean.views[view]?.elements?.[key];
  const got = actual.views[view]?.elements?.[key];
  const entry = `${view}|${key}|@exists`;
  if (!got) return [violation(entry, clean, actual)];
  const out = [];
  diffFields(`${view}|${key}`, want, got, out);
  return out.map((e) => violation(e, clean, actual));
}

// Fix tasks: every field the seed changed is back to its clean value.
export function checkRestored(clean, actual, scope) {
  const out = [];
  for (const entry of scope.mustRestore) {
    const p = parse(entry);
    if (p.field === '@exists') {
      out.push(...restoredElement(clean, actual, p));
    } else if (p.field === '@extra') {
      if (actual.views[p.view]?.elements?.[p.key]) out.push({ entry, expected: 'absent', actual: 'present' });
    } else if (!same(p.field, valueAt(clean, p), valueAt(actual, p))) {
      out.push(violation(entry, clean, actual));
    }
  }
  return out;
}

// Everything the task was not allowed to change still measures as the clean app.
export function checkCollateral(clean, actual, scope) {
  const out = [];
  for (const entry of diffSnapshots(clean, actual)) {
    if (isFree(scope.free, entry)) continue;
    const { view, key, field } = parse(entry);
    if (field === '@extra') {
      const families = new Set(Object.keys(clean.views[view].elements).map(familyOf));
      if (!families.has(familyOf(key))) continue; // a new kind of element: judged by its effect on the others
      out.push({ entry, expected: 'absent', actual: 'present' });
    } else {
      out.push(violation(entry, clean, actual));
    }
  }
  return out;
}

export function describeEntry({ entry, expected, actual }) {
  const { view, key, field } = parse(entry);
  return `${view}  ${key}  ${field}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`;
}
