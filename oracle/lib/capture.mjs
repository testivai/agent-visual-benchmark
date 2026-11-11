// Measures the site as rendered: for every element, where it is, how it is
// painted, what text it shows, how much of it is clipped and whether it is on
// top. Outcomes only: the CSS that produces them (padding, z-index, display…)
// is not recorded, so two ways to the same look measure the same.
import { VIEWS, VIEWPORTS, PAGES, STATES, viewId } from './views.mjs';

// Runs in the page. Self-contained: it is sent to the browser as text.
export function measurePage() {
  const LANDMARK_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'input', 'select', 'textarea', 'label', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'form', 'header', 'footer', 'main', 'nav', 'section', 'aside', 'small', 'strong',
  ]);
  const SAMPLE_POINTS = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  const round = (n) => Math.round(n * 100) / 100;

  const family = (el) => {
    if (el.classList.length > 0) return `.${el.classList[0]}`;
    const tag = el.tagName.toLowerCase();
    return LANDMARK_TAGS.has(tag) ? tag : null;
  };

  const border = (cs, side) => {
    const width = cs[`border${side}Width`];
    const style = cs[`border${side}Style`];
    return style === 'none' || width === '0px' ? 'none' : `${width} ${style} ${cs[`border${side}Color`]}`;
  };

  const paint = (cs) => ({
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage.replace(/https?:\/\/[^/]+\//g, '/'),
    borderTop: border(cs, 'Top'),
    borderRight: border(cs, 'Right'),
    borderBottom: border(cs, 'Bottom'),
    borderLeft: border(cs, 'Left'),
    borderRadius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].join(' '),
    boxShadow: cs.boxShadow,
    opacity: cs.opacity,
    visibility: cs.visibility,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    textDecorationLine: cs.textDecorationLine,
    textTransform: cs.textTransform,
  });

  // The element's own text (not its children's) and the box that text occupies.
  const ownText = (el, rect) => {
    const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
    const text = nodes.map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    const rects = nodes.flatMap((n) => {
      const range = document.createRange();
      range.selectNodeContents(n);
      return [...range.getClientRects()];
    }).filter((r) => r.width > 0 || r.height > 0);
    if (rects.length === 0) return { text, tx: null, ty: null, tw: null, th: null };
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    return {
      text,
      tx: round(left - rect.left),
      ty: round(top - rect.top),
      tw: round(Math.max(...rects.map((r) => r.right)) - left),
      th: round(Math.max(...rects.map((r) => r.bottom)) - top),
    };
  };

  // The next ancestor that can clip `el`: its parent, or for an absolutely
  // positioned element its containing block. Nothing clips a fixed element.
  const clipParent = (el, position) => {
    if (position === 'fixed') return null;
    let anc = el.parentElement;
    if (position === 'absolute') {
      while (anc && getComputedStyle(anc).position === 'static') anc = anc.parentElement;
    }
    return anc && anc !== document.documentElement ? anc : null;
  };

  // Fraction of the element's box left visible by the ancestors that clip it.
  const visibleFraction = (el, rect) => {
    if (rect.width === 0 || rect.height === 0) return null;
    let { left, top, right, bottom } = rect;
    let node = el;
    let position = getComputedStyle(el).position;
    for (let anc = clipParent(node, position); anc; anc = clipParent(node, position)) {
      const cs = getComputedStyle(anc);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = anc.getBoundingClientRect();
        left = Math.max(left, r.left + anc.clientLeft);
        top = Math.max(top, r.top + anc.clientTop);
        right = Math.min(right, r.left + anc.clientLeft + anc.clientWidth);
        bottom = Math.min(bottom, r.top + anc.clientTop + anc.clientHeight);
      }
      node = anc;
      position = cs.position;
    }
    const area = Math.max(0, right - left) * Math.max(0, bottom - top);
    return round(area / (rect.width * rect.height));
  };

  // At how many of five sample points the element (or something inside it) is
  // what a click would land on. Scrolls the element into view first.
  const onTop = (el) => {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    let hits = 0;
    for (const [fx, fy] of SAMPLE_POINTS) {
      const x = Math.min(Math.max(r.left + r.width * fx, 0), window.innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height * fy, 0), window.innerHeight - 1);
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) hits += 1;
    }
    return hits;
  };

  const extras = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return { natural: `${el.naturalWidth}x${el.naturalHeight}`, src: el.getAttribute('src') };
    if (tag === 'a') return { href: el.getAttribute('href') };
    return {};
  };

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const counts = new Map();
  const elements = {};
  const keyed = [];
  for (const el of document.body.querySelectorAll('*')) {
    const fam = family(el);
    if (!fam || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const index = counts.get(fam) ?? 0;
    counts.set(fam, index + 1);
    const key = `${fam}[${index}]`;
    const rect = el.getBoundingClientRect();
    elements[key] = {
      x: round(rect.left + scrollX),
      y: round(rect.top + scrollY),
      w: round(rect.width),
      h: round(rect.height),
      ...ownText(el, rect),
      ...paint(getComputedStyle(el)),
      vis: visibleFraction(el, rect),
      ...extras(el),
    };
    keyed.push([key, el]);
  }
  for (const [key, el] of keyed) elements[key].top = elements[key].w === 0 || elements[key].h === 0 ? null : onTop(el);
  window.scrollTo(scrollX, scrollY);

  const root = document.documentElement;
  return {
    doc: {
      title: document.title,
      scrollW: root.scrollWidth,
      scrollH: root.scrollHeight,
      fonts: [...new Set([...document.fonts].map((f) => `${f.family.replace(/^["']|["']$/g, '')}:${f.status}`))].sort().join(','),
    },
    elements,
  };
}

const STILL = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((done) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    })));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

const firstLine = (err) => String(err?.message ?? err).split('\n')[0];

async function captureView(page, baseUrl, view, stateTimeout) {
  try {
    await page.goto(`${baseUrl}/${PAGES[view.page]}`, { waitUntil: 'load', timeout: 15000 });
    await page.addStyleTag({ content: STILL });
    await settle(page);
  } catch (err) {
    return { error: `could not load the ${view.page} page: ${firstLine(err)}` };
  }
  if (view.state) {
    try {
      await STATES[view.state].reach(page, stateTimeout);
      await settle(page);
    } catch (err) {
      return { error: `could not ${STATES[view.state].what}: ${firstLine(err)}` };
    }
  }
  return page.evaluate(measurePage);
}

// Measures every view of the site served at baseUrl.
export async function captureSnapshot(browser, baseUrl, { views = VIEWS, stateTimeout = 3000 } = {}) {
  const out = { views: {} };
  for (const viewport of Object.keys(VIEWPORTS)) {
    const mine = views.filter((v) => v.viewport === viewport);
    if (mine.length === 0) continue;
    const context = await browser.newContext({ viewport: VIEWPORTS[viewport], deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      for (const view of mine) out.views[viewId(view)] = await captureView(page, baseUrl, view, stateTimeout);
    } finally {
      await context.close();
    }
  }
  return out;
}
