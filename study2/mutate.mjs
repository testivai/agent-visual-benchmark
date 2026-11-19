// Study 2's mutations (study2/PREREGISTRATION.md, section 4): the property
// classes, the candidates of a class among the CSS rules the page uses, and a
// new value by the class's fixed rule. Which class and which candidate are
// drawn is decided in generate.mjs. Every choice comes from a random passed in,
// which comes from a recorded seed.

// The published classes and their properties; the colour class also takes
// custom properties that hold a colour (see classOf).
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
const RGB_TRIPLE = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/;

// The class of a declaration, by its property. A custom property is a colour
// when it holds a literal colour, or an r, g, b triple under a name ending in
// -rgb (Bootstrap 5 keeps most of its colours in custom properties); any other
// custom property has no class and is never mutated.
export function classOf(property, value) {
  if (!property.startsWith('--')) return CLASS_OF[property] ?? null;
  if (property.endsWith('-rgb') && RGB_TRIPLE.test(value)) return 'colour';
  return perturbColour(value) === null ? null : 'colour';
}

function perturbCustom(property, value) {
  const m = property.endsWith('-rgb') ? value.match(RGB_TRIPLE) : null;
  return m ? shiftColour([m[1], m[2], m[3]].map(Number)).join(', ') : perturbColour(value);
}

// A new value for property: value, or null when the class's rule cannot apply.
export function perturb(property, value, random) {
  const cls = classOf(property, value);
  if (!cls) return null;
  if (property.startsWith('--')) return perturbCustom(property, value);
  if (COLOUR_CLASSES.has(cls)) return perturbColour(value);
  if (LENGTH_CLASSES.has(cls)) return perturbLength(value, random);
  return perturbKeyword(property, value, random);
}

// Whether perturb can change this value, without using the random.
const mutable = (property, value) => perturb(property, value, () => 0) !== null;

// The candidates of a class: its declarations that the class's rule can change,
// in the rules whose ids are in used. skip: the valueStart of declarations
// already mutated by another task on the site; takenRules: rules this task has
// already changed. In file order; the caller draws among them.
export function candidatesOf(rules, used, cls, { skip = new Set(), takenRules = new Set() } = {}) {
  return rules
    .filter((r) => used.has(r.id) && !takenRules.has(r.id))
    .flatMap((r) => r.declarations
      .filter((d) => classOf(d.property, d.value) === cls && !skip.has(d.valueStart) && mutable(d.property, d.value))
      .map((d) => ({ rule: r, d })));
}

// The mutation of one declaration: where it is in the file, and its new value.
export function mutationOf(rule, d, cls, random) {
  return {
    ruleId: rule.id, selector: rule.selector, media: rule.media, class: cls, property: d.property,
    from: d.value, to: perturb(d.property, d.value, random), valueStart: d.valueStart, valueEnd: d.valueEnd,
  };
}

// The stylesheet with each mutation's value replaced in place.
export function applyMutations(css, mutations) {
  return [...mutations].sort((a, b) => b.valueStart - a.valueStart)
    .reduce((text, m) => text.slice(0, m.valueStart) + m.to + text.slice(m.valueEnd), css);
}
