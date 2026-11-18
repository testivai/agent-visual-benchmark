// Which of a stylesheet's rules are used (study2/PREREGISTRATION.md, section 4):
// a rule is used when it matches at least one element in a captured view, under
// that view's media. Mutations are drawn only from used rules; most rules of a
// compiled Bootstrap stylesheet match nothing on the page. Being used is only a
// first sieve: the validity filters then check that a mutation shows.
import { VIEWPORTS } from '../oracle/lib/views.mjs';
import { startStaticServer } from '../harness/static-server.mjs';

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

function quotedEnd(s, i) {
  let j = i + 1;
  while (j < s.length && s[j] !== s[i]) j += s[j] === '\\' ? 2 : 1;
  return j + 1;
}

function parenEnd(s, open) {
  let depth = 0;
  for (let j = open; j < s.length; j += 1) {
    if (s[j] === '(') depth += 1;
    else if (s[j] === ')' && --depth === 0) return j + 1;
  }
  return s.length;
}

// Where the pseudo-element starting at the colon at i ends, or -1 when it is a pseudo-class.
function pseudoElementEnd(s, i) {
  const double = s[i + 1] === ':';
  const nameStart = i + (double ? 2 : 1);
  const name = s.slice(nameStart).match(/^-?[\w-]+/)?.[0] ?? '';
  if (!double && !LEGACY_PSEUDO_ELEMENTS.has(name.toLowerCase())) return -1;
  const end = nameStart + name.length;
  return s[end] === '(' ? parenEnd(s, end) : end;
}

// The selector list split at its top-level commas.
function splitList(s) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let j = 0; j < s.length; j += 1) {
    if (s[j] === '"' || s[j] === "'") j = quotedEnd(s, j) - 1;
    else if (s[j] === '(') depth += 1;
    else if (s[j] === ')') depth -= 1;
    else if (s[j] === ',' && depth === 0) {
      parts.push(s.slice(start, j));
      start = j + 1;
    }
  }
  return [...parts, s.slice(start)];
}

// The selector an element must match for the rule to apply to it or to one of
// its pseudo-elements: the rule's selector with the pseudo-elements taken off.
export function matchSelector(selector) {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    const c = selector[i];
    const end = c === '"' || c === "'" ? quotedEnd(selector, i) : -1;
    const pseudo = c === ':' ? pseudoElementEnd(selector, i) : -1;
    if (end >= 0) out += selector.slice(i, end);
    else if (pseudo < 0) out += c;
    i = Math.max(end, pseudo, i + 1);
  }
  return splitList(out).map((part) => part.trim() || '*').join(', ');
}

// Runs in the page: the ids of the rules whose media match and whose selector
// matches an element. A selector this browser does not know matches nothing.
function matchedIds(rules) {
  const out = [];
  for (const rule of rules) {
    if (rule.media && !window.matchMedia(rule.media).matches) continue;
    try {
      if (document.querySelector(rule.match)) out.push(rule.id);
    } catch {
      // not a selector this browser knows
    }
  }
  return out;
}

const nextFrames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));

// Every page at every viewport, loaded as the oracle's capture loads it.
// -> { used: Set of rule ids, byView: { '<page>@<viewport>': [rule ids] } }
export async function usedRules(browser, siteDir, rules, { pages, viewports = VIEWPORTS }) {
  const probe = rules.map((r) => ({ id: r.id, media: r.media, match: matchSelector(r.selector) }));
  const server = await startStaticServer(siteDir);
  const byView = {};
  try {
    for (const [viewport, size] of Object.entries(viewports)) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        for (const name of pages) {
          await page.goto(`${server.url}/${name}`, { waitUntil: 'load', timeout: 15000 });
          await page.evaluate(nextFrames);
          byView[`${name}@${viewport}`] = await page.evaluate(matchedIds, probe);
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await server.close();
  }
  return { used: new Set(Object.values(byView).flat()), byView };
}
