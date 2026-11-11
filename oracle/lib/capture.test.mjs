// What the in-page measurement records, on small hand-made pages, and that
// measuring the real app twice gives the same answer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { measurePage, captureSnapshot } from './capture.mjs';
import { VIEWS, viewId } from './views.mjs';
import { diffSnapshots } from './compare.mjs';
import { startStaticServer } from '../../harness/static-server.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function measure(html, viewport = { width: 800, height: 600 }) {
  const page = await browser.newPage({ viewport });
  try {
    await page.setContent(`<!DOCTYPE html><html><head><style>body{margin:0;font:16px/20px monospace}</style></head><body>${html}</body></html>`);
    return await page.evaluate(measurePage);
  } finally {
    await page.close();
  }
}

test('elements are keyed by their first class, or by tag for common tags, with an index', async () => {
  const { elements } = await measure(`
    <h1>Title</h1>
    <div><p>one</p><p class="note big">two</p></div>
    <a class="btn btn-primary" href="x.html">Go</a>
    <a class="btn" href="y.html">Stop</a>
    <span>plain span</span>`);
  assert.deepEqual(Object.keys(elements).sort(), ['.btn[0]', '.btn[1]', '.note[0]', 'h1[0]', 'p[0]']);
  assert.equal(elements['.btn[1]'].text, 'Stop');
  assert.equal(elements['.btn[0]'].href, 'x.html');
});

test('a stray line break is an element like any other', async () => {
  const { elements } = await measure('<p>one</p><br><br><p>two</p>');
  assert.deepEqual(Object.keys(elements).sort(), ['br[0]', 'br[1]', 'p[0]', 'p[1]']);
});

test('boxes are in page coordinates, whatever the scroll position', async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<body style="margin:0"><div style="height:2000px"></div><p class="deep" style="margin:0;height:30px;width:200px">x</p></body>');
  await page.evaluate(() => window.scrollTo(0, 500));
  const { elements, doc } = await page.evaluate(measurePage);
  await page.close();
  assert.equal(elements['.deep[0]'].y, 2000);
  assert.equal(elements['.deep[0]'].x, 0);
  assert.equal(elements['.deep[0]'].w, 200);
  assert.equal(elements['.deep[0]'].h, 30);
  assert.equal(doc.scrollH, 2030);
});

test('paint styles are recorded as outcomes: colours, borders, radius, shadow, type', async () => {
  const { elements } = await measure(`<p class="a" style="color:#f00;background:#00f;border:2px solid #0f0;border-radius:4px;
    box-shadow:0 1px 2px rgba(0,0,0,.5);font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center">x</p>
    <p class="b">y</p>`);
  const a = elements['.a[0]'];
  assert.equal(a.color, 'rgb(255, 0, 0)');
  assert.equal(a.backgroundColor, 'rgb(0, 0, 255)');
  assert.equal(a.borderTop, '2px solid rgb(0, 255, 0)');
  assert.equal(a.borderRadius, '4px 4px 4px 4px');
  assert.match(a.boxShadow, /rgba\(0, 0, 0, 0\.5\) 0px 1px 2px/);
  assert.equal(a.fontWeight, '700');
  assert.equal(a.textTransform, 'uppercase');
  assert.equal(a.letterSpacing, '1px');
  assert.equal(a.textAlign, 'center');
  assert.equal(elements['.b[0]'].borderTop, 'none');
});

test('the mechanism is not recorded: two ways to the same look measure the same', async () => {
  const one = await measure('<div class="box" style="display:flow-root;padding:10px;width:200px;box-sizing:border-box"><p class="t" style="margin:0">text</p></div>');
  const two = await measure('<div class="box" style="display:flow-root;width:200px"><p class="t" style="margin:10px">text</p></div>');
  assert.deepEqual(diffSnapshots({ views: { v: one } }, { views: { v: two } }), []);
});

test('text is measured: its own text, its width, and where it sits in the box', async () => {
  const { elements } = await measure('<p class="t" style="width:300px;padding-left:20px;margin:0">abcde <b>bold</b> fg</p>');
  const t = elements['.t[0]'];
  assert.equal(t.text, 'abcde fg');
  assert.equal(t.tx, 20);
  assert.ok(t.tw > 0 && t.th > 0);
  const none = await measure('<div class="empty" style="width:10px;height:10px"></div>');
  assert.equal(none.elements['.empty[0]'].text, '');
  assert.equal(none.elements['.empty[0]'].tw, null);
});

test('text that spills out of its box is seen in the text width', async () => {
  const wrap = await measure('<p class="t" style="width:100px;margin:0;overflow-wrap:anywhere">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</p>');
  const spill = await measure('<p class="t" style="width:100px;margin:0">aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</p>');
  assert.ok(wrap.elements['.t[0]'].tw <= 100);
  assert.ok(spill.elements['.t[0]'].tw > 100);
});

test('vis is the fraction of the box that no ancestor clips', async () => {
  const { elements } = await measure(`
    <div class="clip" style="position:relative;width:100px;height:100px;overflow:hidden">
      <span class="half" style="position:absolute;top:-10px;left:0;width:40px;height:20px"></span>
      <span class="inside" style="position:absolute;top:10px;left:0;width:40px;height:20px"></span>
    </div>
    <div class="open" style="position:relative;width:100px;height:100px">
      <span class="out" style="position:absolute;top:-10px;left:0;width:40px;height:20px"></span>
    </div>`);
  assert.equal(elements['.half[0]'].vis, 0.5);
  assert.equal(elements['.inside[0]'].vis, 1);
  assert.equal(elements['.out[0]'].vis, 1);
});

test('an absolutely positioned element is not clipped by an ancestor that is not its containing block', async () => {
  const { elements } = await measure(`
    <div class="outer" style="position:relative;width:200px;height:200px">
      <div class="mid" style="width:50px;height:50px;overflow:hidden">
        <span class="abs" style="position:absolute;top:100px;left:100px;width:40px;height:20px"></span>
      </div>
    </div>`);
  assert.equal(elements['.abs[0]'].vis, 1);
});

test('top counts the sample points where the element is what you would click', async () => {
  const { elements } = await measure(`
    <div class="under" style="position:absolute;top:0;left:0;width:100px;height:100px;background:#eee"></div>
    <div class="cover" style="position:absolute;top:0;left:0;width:100px;height:60px;background:#333"></div>
    <div class="free" style="position:absolute;top:200px;left:0;width:100px;height:100px;background:#eee"><p class="child" style="margin:0">hi</p></div>
    <div class="behind" style="position:relative;top:320px;width:100px;height:40px;background:#fff">
      <span class="tag" style="position:absolute;z-index:-1;top:10px;left:10px;width:40px;height:20px;background:red"></span>
    </div>`);
  assert.equal(elements['.under[0]'].top, 2, 'the two lower points are free, the centre and the upper two are covered');
  assert.equal(elements['.cover[0]'].top, 5);
  assert.equal(elements['.free[0]'].top, 5, 'a child on top of its parent does not cover it');
  assert.equal(elements['.tag[0]'].top, 0, 'painted behind its own parent');
});

test('an element below the fold is scrolled to before it is sampled', async () => {
  const { elements } = await measure('<div style="height:3000px"></div><p class="deep" style="margin:0;height:40px">x</p>');
  assert.equal(elements['.deep[0]'].top, 5);
});

test('an element with no box has null for what cannot be measured', async () => {
  const { elements } = await measure('<p class="gone" style="display:none">x</p>');
  const gone = elements['.gone[0]'];
  assert.equal(gone.w, 0);
  assert.equal(gone.vis, null);
  assert.equal(gone.top, null);
});

test('images record their natural size and whether they loaded', async () => {
  const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" width="40" height="20"/>');
  const { elements } = await measure(`<img class="ok" src="data:image/svg+xml,${svg}" width="80" height="40"><img class="bad" src="data:image/png;base64,AAAA" width="10" height="10">`);
  assert.equal(elements['.ok[0]'].natural, '40x20');
  assert.equal(elements['.bad[0]'].natural, '0x0');
});

test('the page records its size and its fonts', async () => {
  const { doc } = await measure('<div style="width:1200px;height:10px"></div>');
  assert.equal(doc.scrollW, 1200);
  assert.equal(typeof doc.fonts, 'string');
});

test('view ids name the page, the viewport and the state', () => {
  assert.equal(viewId({ page: 'home', viewport: 'desktop' }), 'home@desktop');
  assert.equal(viewId({ page: 'orders', viewport: 'mobile', state: 'dialog' }), 'orders@mobile#dialog');
  const ids = VIEWS.map(viewId);
  assert.equal(new Set(ids).size, ids.length);
  for (const page of ['home', 'products', 'pricing', 'orders', 'contact', 'about']) {
    assert.ok(ids.includes(`${page}@desktop`), page);
    assert.ok(ids.includes(`${page}@mobile`), page);
    assert.ok(ids.includes(`${page}@mobile#menu`), page);
  }
  assert.ok(ids.includes('orders@desktop#dialog'));
  assert.ok(ids.includes('contact@desktop#errors'));
  assert.ok(ids.includes('contact@desktop#sent'));
});

test('the real app: every view is reached, and two captures are identical', async () => {
  const server = await startStaticServer(path.join(REPO_ROOT, 'app', 'site'));
  try {
    const a = await captureSnapshot(browser, server.url);
    const b = await captureSnapshot(browser, server.url);
    assert.deepEqual(Object.keys(a.views).sort(), VIEWS.map(viewId).sort());
    for (const [id, view] of Object.entries(a.views)) assert.equal(view.error, undefined, `${id}: ${view.error}`);
    assert.deepEqual(diffSnapshots(a, b), []);

    const home = a.views['home@desktop'];
    assert.equal(home.doc.fonts, 'Acme Sans:loaded');
    assert.equal(home.doc.scrollW, 1280);
    assert.equal(home.elements['.hero-art[0]'].natural, '420x280');
    assert.equal(home.elements['.stat[0]'].top, 5);

    assert.equal(a.views['home@mobile'].elements['.site-nav[0]'].w, 0, 'the menu is closed on a phone');
    assert.ok(a.views['home@mobile#menu'].elements['.site-nav[0]'].w > 0, 'and open in the menu view');
    assert.equal(a.views['orders@desktop'].elements['.modal-dialog[0]'].w, 0);
    assert.ok(a.views['orders@desktop#dialog'].elements['.modal-dialog[0]'].w > 0);
    assert.match(a.views['contact@desktop#sent'].elements['.alert[0]'].text, /^Thanks, /);
    assert.ok(a.views['contact@desktop#errors'].elements['.form-error[0]'].w > 0);
  } finally {
    await server.close();
  }
});

test('a view whose state cannot be reached is an error on that view, not a crash', async () => {
  const server = await startStaticServer(path.join(REPO_ROOT, 'harness', 'fixtures', 'mini-bench', 'app', 'site'));
  try {
    const snap = await captureSnapshot(browser, server.url, {
      views: [{ page: 'home', viewport: 'desktop' }, { page: 'home', viewport: 'mobile', state: 'menu' }],
      stateTimeout: 500,
    });
    assert.ok(snap.views['home@desktop'].elements['h1[0]']);
    assert.match(snap.views['home@mobile#menu'].error, /menu/i);
  } finally {
    await server.close();
  }
});
