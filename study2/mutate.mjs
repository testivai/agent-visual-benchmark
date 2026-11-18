// Study 2's mutations (study2/PREREGISTRATION.md, section 4): a property class
// chosen at random, then one declaration of that class at random among the CSS
// rules the page uses, then a new value by the class's fixed rule. Every choice
// comes from the random passed in, which comes from a recorded seed.

export const CLASSES = {
  colour: ['color'],
  background: ['background-color', 'background'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'letter-spacing': ['letter-spacing'],
  'line-height': ['line-height'],
  margin: ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  width: ['width', 'max-width', 'min-width'],
  'display-and-flex': ['display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap'],
  'position-and-z-index': ['position', 'z-index'],
  border: ['border', 'border-width', 'border-radius', 'border-top', 'border-right', 'border-bottom', 'border-left'],
  opacity: ['opacity'],
  overflow: ['overflow', 'overflow-x', 'overflow-y'],
  'text-transform': ['text-transform'],
};

const CLASS_OF = Object.fromEntries(Object.entries(CLASSES).flatMap(([k, props]) => props.map((p) => [p, k])));
const pick = (list, random) => list[Math.floor(random() * list.length)];

// --- lengths: the first non-zero number scaled by 0.5 or 1.5 -------------------

const NUMBER = /(-?\d*\.?\d+)(px|rem|em|%|vh|vw)?/g;
const round = (x) => String(Math.round(x * 1000) / 1000);

function scaleNumber(n, unit, factor) {
  if (unit !== 'px') return round(n * factor);
  const scaled = Math.round(n * factor);
  return String(factor > 1 ? Math.max(n + 1, scaled) : Math.max(0, Math.min(n - 1, scaled)));
}

function perturbLength(value, random) {
  if (/var\(|calc\(/.test(value)) return null;
  const factor = random() < 0.5 ? 0.5 : 1.5;
  let done = false;
  const out = value.replace(NUMBER, (whole, num, unit = '') => {
    if (done || Number(num) === 0) return whole;
    done = true;
    return `${scaleNumber(Number(num), unit, factor)}${unit}`;
  });
  return done ? out : null;
}

// --- colours: hue half-way round, or lightness inverted for greys ---------------

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i;
const RGB = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/i;
const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };

function toHsl(r, g, b) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function toRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

function shiftColour([r, g, b]) {
  const [h, s, l] = toHsl(r, g, b);
  return s < 0.15 ? toRgb(h, s, 1 - l) : toRgb((h + 180) % 360, s, l);
}

const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

function perturbColour(value) {
  if (/var\(/.test(value)) return null;
  const h = value.match(HEX);
  if (h) {
    const six = h[1].length === 3 ? [...h[1]].map((c) => c + c).join('') : h[1];
    const rgb = [0, 2, 4].map((i) => parseInt(six.slice(i, i + 2), 16));
    return value.replace(h[0], hex(shiftColour(rgb)));
  }
  const m = value.match(RGB);
  if (m) {
    const [r, g, b] = shiftColour([m[1], m[2], m[3]].map(Number));
    return value.replace(m[0], m[4] === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${m[4]})`);
  }
  const named = value.trim().toLowerCase();
  return NAMED[named] ? hex(shiftColour(NAMED[named])) : null;
}

// --- keywords: another value of the same property --------------------------------

const WEIGHT = { normal: '700', bold: '400', 100: '700', 200: '700', 300: '700', 400: '700', 500: '300', 600: '300', 700: '400', 800: '400', 900: '400' };
const SWAPS = {
  display: ['block', 'inline-block', 'flex', 'none'],
  'flex-direction': ['row', 'column'],
  'justify-content': ['flex-start', 'center', 'flex-end', 'space-between'],
  'align-items': ['flex-start', 'center', 'flex-end', 'stretch'],
  'flex-wrap': ['wrap', 'nowrap'],
  position: ['static', 'relative', 'absolute'],
};
const OVERFLOW = { hidden: 'visible', visible: 'hidden', auto: 'hidden', scroll: 'hidden', clip: 'visible' };

function important(value) {
  const m = value.match(/^(.*?)(\s*!important)$/i);
  return m ? [m[1].trim(), m[2]] : [value.trim(), ''];
}

function perturbKeyword(property, value, random) {
  const [v, imp] = important(value);
  const key = v.toLowerCase();
  let out = null;
  if (property === 'font-weight') out = WEIGHT[key] ?? null;
  else if (property === 'text-transform') out = key === 'none' ? 'uppercase' : (['uppercase', 'lowercase', 'capitalize'].includes(key) ? 'none' : null);
  else if (property.startsWith('overflow')) out = OVERFLOW[key] ?? null;
  else if (property === 'opacity') out = Number.isFinite(Number(key)) ? (Number(key) >= 0.5 ? '0.3' : '1') : null;
  else if (property === 'z-index') out = /^-?\d+$/.test(key) ? (Number(key) > 0 ? '-1' : '10') : null;
  else if (SWAPS[property] && /^[a-z-]+$/.test(key)) out = pick(SWAPS[property].filter((x) => x !== key), random);
  return out === null ? null : `${out}${imp}`;
}

const LENGTH_CLASSES = new Set(['font-size', 'letter-spacing', 'line-height', 'margin', 'padding', 'width', 'border']);
const COLOUR_CLASSES = new Set(['colour', 'background']);

// A new value for property: value, or null when the class's rule cannot apply.
export function perturb(property, value, random) {
  const cls = CLASS_OF[property];
  if (!cls) return null;
  if (COLOUR_CLASSES.has(cls)) return perturbColour(value);
  if (LENGTH_CLASSES.has(cls)) return perturbLength(value, random);
  return perturbKeyword(property, value, random);
}

// Whether perturb can change this value, without using the random.
const mutable = (property, value) => perturb(property, value, () => 0) !== null;

const drawable = (d, cls, skip) => CLASSES[cls].includes(d.property) && !skip.has(d.valueStart) && mutable(d.property, d.value);

const MAX_DRAWS = 500;

// count mutations on different rules, each a declaration of a class drawn at
// random, among the rules whose ids are in used. skip: the valueStart of
// declarations not to draw (already mutated by another task on the site).
export function drawMutations(rules, used, random, count, { skip = new Set() } = {}) {
  const out = [];
  const classes = Object.keys(CLASSES);
  for (let tries = 0; out.length < count && tries < MAX_DRAWS; tries++) {
    const cls = pick(classes, random);
    const taken = new Set(out.map((m) => m.ruleId));
    const candidates = rules
      .filter((r) => used.has(r.id) && !taken.has(r.id))
      .flatMap((r) => r.declarations.filter((d) => drawable(d, cls, skip)).map((d) => ({ rule: r, d })));
    if (candidates.length === 0) continue;
    const { rule, d } = pick(candidates, random);
    out.push({
      ruleId: rule.id, selector: rule.selector, media: rule.media, class: cls, property: d.property,
      from: d.value, to: perturb(d.property, d.value, random), valueStart: d.valueStart, valueEnd: d.valueEnd,
    });
  }
  return out;
}

// The stylesheet with each mutation's value replaced in place.
export function applyMutations(css, mutations) {
  return [...mutations].sort((a, b) => b.valueStart - a.valueStart)
    .reduce((text, m) => text.slice(0, m.valueStart) + m.to + text.slice(m.valueEnd), css);
}
