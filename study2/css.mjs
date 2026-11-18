// A small CSS source parser for study 2's mutations: every style rule, the
// @media it sits in, and each declaration's value with its offsets in the file,
// so a mutation edits the real source in place. Comments, strings and
// parentheses are skipped over; @font-face, @keyframes and other at-rules that
// hold no style rules are left out.

function skipComment(css, i) {
  const end = css.indexOf('*/', i + 2);
  return end < 0 ? css.length : end + 2;
}

function skipString(css, i) {
  const quote = css[i];
  let j = i + 1;
  while (j < css.length && css[j] !== quote) j += css[j] === '\\' ? 2 : 1;
  return j + 1;
}

// One step over css at i: past a comment or a string, else one character.
function step(css, i) {
  if (css.startsWith('/*', i)) return skipComment(css, i);
  if (css[i] === '"' || css[i] === "'") return skipString(css, i);
  return i + 1;
}

// From i to the first {, ; or } outside comments, strings and parentheses.
function readPrelude(css, i) {
  let j = i;
  let depth = 0;
  while (j < css.length) {
    const c = css[j];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (depth === 0 && (c === '{' || c === ';' || c === '}')) break;
    j = step(css, j);
  }
  return { text: css.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, ''), end: j };
}

// The index of the } that closes the { at open.
function blockEnd(css, open) {
  let depth = 0;
  for (let j = open; j < css.length; j = step(css, j)) {
    if (css[j] === '{') depth += 1;
    else if (css[j] === '}' && --depth === 0) return j;
  }
  return css.length;
}

function trimmed(css, start, end) {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(css[s])) s += 1;
  while (e > s && /\s/.test(css[e - 1])) e -= 1;
  return [s, e];
}

// The declarations between start and end: split at ; and : outside strings and parentheses.
function parseDeclarations(css, start, end) {
  const out = [];
  let segment = start;
  let colon = -1;
  let depth = 0;
  const flush = (stop) => {
    if (colon >= 0) {
      const property = css.slice(segment, colon).replace(/\/\*[\s\S]*?\*\//g, '').trim().toLowerCase();
      const [valueStart, valueEnd] = trimmed(css, colon + 1, stop);
      if (property) out.push({ property, value: css.slice(valueStart, valueEnd), valueStart, valueEnd });
    }
    segment = stop + 1;
    colon = -1;
  };
  for (let j = start; j < end; j = step(css, j)) {
    const c = css[j];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (depth === 0 && c === ':' && colon < 0) colon = j;
    else if (depth === 0 && c === ';') flush(j);
  }
  flush(end);
  return out;
}

const joinMedia = (outer, inner) => (outer ? `${outer} and ${inner}` : inner);

function parseBlock(css, start, end, media, rules) {
  let i = start;
  while (i < end) {
    while (i < end && (/\s/.test(css[i]) || css.startsWith('/*', i))) i = /\s/.test(css[i]) ? i + 1 : skipComment(css, i);
    if (i >= end || css[i] === '}') break;
    const prelude = readPrelude(css, i);
    if (css[prelude.end] !== '{') {
      i = prelude.end + 1;
      continue;
    }
    const close = blockEnd(css, prelude.end);
    const head = prelude.text.trim();
    const at = head.match(/^@([\w-]+)\s*(.*)$/s);
    if (!at) {
      rules.push({ id: rules.length, selector: head.replace(/\s+/g, ' '), media, start: i, end: close + 1, declarations: parseDeclarations(css, prelude.end + 1, close) });
    } else if (at[1].toLowerCase() === 'media') {
      parseBlock(css, prelude.end + 1, close, joinMedia(media, at[2].trim()), rules);
    } else if (at[1].toLowerCase() === 'supports') {
      parseBlock(css, prelude.end + 1, close, media, rules);
    }
    i = close + 1;
  }
  return rules;
}

// Every style rule in the stylesheet: { id, selector, media, start, end, declarations }.
export function parseRules(css) {
  return parseBlock(css, 0, css.length, null, []);
}
