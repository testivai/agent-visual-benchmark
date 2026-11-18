import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectionOrder, eligibility, stripRemoteHtml, stripRemoteCss, sitePages, offlineFacts } from './sites.mjs';

test('the order sites are tried in comes from the seed alone, not from how the list was given', () => {
  const names = ['startbootstrap-agency', 'startbootstrap-resume', 'startbootstrap-sb-admin', 'startbootstrap-creative'];
  const a = selectionOrder(names, 42);
  assert.deepEqual(a, selectionOrder([...names].reverse(), 42));
  assert.deepEqual([...a].sort(), [...names].sort());
  assert.notDeepEqual(selectionOrder(names, 42), selectionOrder(names, 43), 'another seed, another order (for these four)');
});

test('remote stylesheets, preconnects and scripts are removed from a page; links to other sites stay', () => {
  const html = [
    '<link href="https://fonts.googleapis.com/css?family=Montserrat:400,700" rel="stylesheet" type="text/css" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com">',
    '<link href="css/styles.css" rel="stylesheet" />',
    '<script src="https://use.fontawesome.com/releases/v6.3.0/js/all.js" crossorigin="anonymous"></script>',
    '<script src="js/scripts.js"></script>',
    '<a href="https://startbootstrap.com/solution/contact-forms">forms</a>',
  ].join('\n');
  const out = stripRemoteHtml(html);
  assert.deepEqual(out.removed, [
    'https://fonts.googleapis.com/css?family=Montserrat:400,700',
    'https://fonts.gstatic.com',
    'https://use.fontawesome.com/releases/v6.3.0/js/all.js',
  ]);
  assert.match(out.html, /css\/styles\.css/);
  assert.match(out.html, /js\/scripts\.js/);
  assert.match(out.html, /startbootstrap\.com\/solution\/contact-forms/, 'a plain link is not a resource');
  assert.doesNotMatch(out.html, /googleapis|gstatic|fontawesome/);
});

test('remote @imports are removed from a stylesheet; any other remote url() is counted, not touched', () => {
  const css = [
    '@import url("https://fonts.googleapis.com/css2?family=Inter");',
    '@import "https://example.com/a.css";',
    '.hero { background: url("../assets/img/bg.jpg"); }',
    '.icon { background-image: url("data:image/svg+xml,%3csvg%3e%3c/svg%3e"); }',
    '.x { background: url(https://cdn.example.com/x.png); }',
  ].join('\n');
  const out = stripRemoteCss(css);
  assert.deepEqual(out.removed, ['https://fonts.googleapis.com/css2?family=Inter', 'https://example.com/a.css']);
  assert.equal(out.remoteLeft, 1);
  assert.match(out.css, /bg\.jpg/);
  assert.match(out.css, /cdn\.example\.com/, 'left as it is, and counted');
});

test('eligibility: a built page, not an admin dashboard, renders offline with no failed local request', () => {
  const good = { name: 'startbootstrap-agency', pages: ['index.html'], remoteLeft: 0, failedLocal: [], textChars: 1200 };
  assert.deepEqual(eligibility(good), { ok: true, reasons: [] });
  assert.deepEqual(eligibility({ ...good, name: 'startbootstrap-sb-admin-2' }).reasons, ['an admin dashboard']);
  assert.deepEqual(eligibility({ ...good, pages: [] }).reasons, ['no built page']);
  assert.deepEqual(eligibility({ ...good, remoteLeft: 2 }).reasons, ['2 remote url() left in its CSS']);
  assert.deepEqual(eligibility({ ...good, failedLocal: ['/assets/img/x.jpg'] }).reasons, ['a local request failed: /assets/img/x.jpg']);
  assert.deepEqual(eligibility({ ...good, textChars: 0 }).reasons, ['no visible text offline']);
});

test('pages: index.html first, then the others by name, at most six', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-pages-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const f of ['post.html', 'about.html', 'index.html', 'a.html', 'b.html', 'c.html', 'd.html', 'notes.txt']) fs.writeFileSync(path.join(dir, f), '');
  assert.deepEqual(sitePages(dir), ['index.html', 'a.html', 'about.html', 'b.html', 'c.html', 'd.html']);
});

test('offline facts: a real browser, with every request off this machine refused', { timeout: 60000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-site-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'css'));
  fs.writeFileSync(path.join(dir, 'css', 'styles.css'), 'body { color: #222 }');
  fs.writeFileSync(path.join(dir, 'index.html'), '<link href="css/styles.css" rel="stylesheet"><img src="img/missing.png"><h1>Hello offline</h1>');
  fs.writeFileSync(path.join(dir, 'about.html'), '<link href="https://fonts.googleapis.com/css?family=X" rel="stylesheet"><p>About</p>');
  const facts = await offlineFacts(dir, ['index.html', 'about.html']);
  assert.deepEqual(facts.failedLocal, ['/img/missing.png']);
  assert.equal(facts.remoteRequests, 1, 'the remote stylesheet was asked for, and refused');
  assert.ok(facts.textChars >= 'Hello offline'.length + 'About'.length);
});

// A package as npm pack makes it: package/dist/... and package/LICENSE, gzipped.
import { execFileSync } from 'node:child_process';
import { importTarball, chooseSites } from './sites.mjs';

function fakePackage(root, name, files) {
  const pkg = path.join(root, `${name}-src`, 'package');
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(pkg, rel)), { recursive: true });
    fs.writeFileSync(path.join(pkg, rel), body);
  }
  const tgz = path.join(root, `${name}.tgz`);
  execFileSync('tar', ['czf', tgz, '-C', path.dirname(pkg), 'package']);
  return tgz;
}

const GOOD = {
  'LICENSE': 'MIT',
  'dist/index.html': '<link href="https://fonts.googleapis.com/css?family=X" rel="stylesheet"><link href="css/styles.css" rel="stylesheet"><h1>Agency</h1>',
  'dist/css/styles.css': '@import url("https://fonts.googleapis.com/css2?family=Y"); h1 { color: #123 }',
  'src/scss/styles.scss': 'h1 { color: #123 }',
};

test('import: the built site and its licence, with remote resources stripped and listed', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-import-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const out = importTarball(fakePackage(root, 'startbootstrap-good', GOOD), path.join(root, 'out'));
  assert.deepEqual(out.pages, ['index.html']);
  assert.deepEqual(out.removed.sort(), ['https://fonts.googleapis.com/css2?family=Y', 'https://fonts.googleapis.com/css?family=X']);
  assert.equal(out.remoteLeft, 0);
  assert.equal(fs.readFileSync(path.join(root, 'out', 'LICENSE'), 'utf8'), 'MIT');
  assert.ok(!fs.existsSync(path.join(root, 'out', 'site', 'scss')), 'only the built site, not its sources');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'out', 'site', 'index.html'), 'utf8'), /googleapis/);
  assert.equal(importTarball(fakePackage(root, 'startbootstrap-nodist', { LICENSE: 'MIT', 'src/index.pug': 'h1' }), path.join(root, 'out2')).pages.length, 0);
});

test('choose: sites are tried in the seeded order, ineligible ones skipped with their reason, until enough', { timeout: 120000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-choose-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packages = {
    'startbootstrap-a': fakePackage(root, 'a', GOOD),
    'startbootstrap-b': fakePackage(root, 'b', { ...GOOD, 'dist/index.html': '<img src="img/gone.png"><h1>B</h1>' }),
    'startbootstrap-sb-admin': fakePackage(root, 'adm', GOOD),
    'startbootstrap-c': fakePackage(root, 'c', GOOD),
  };
  const fetched = [];
  const fetchTarball = (name) => { fetched.push(name); return { tarball: packages[name], version: '1.0.0', integrity: `sha512-${name}` }; };
  const names = Object.keys(packages);
  const out = await chooseSites({ names, seed: 7, count: 2, destRoot: path.join(root, 'sites'), fetchTarball });
  const order = selectionOrder(names, 7);
  assert.deepEqual(fetched, order.slice(0, fetched.length), 'tried in the seeded order, and only as far as needed');
  assert.equal(out.chosen.length, 2);
  for (const tried of out.tried) {
    const expectOk = tried.name === 'startbootstrap-a' || tried.name === 'startbootstrap-c';
    assert.equal(tried.ok, expectOk, tried.name);
  }
  assert.ok(out.tried.find((x) => x.name === 'startbootstrap-sb-admin')?.reasons.includes('an admin dashboard') ?? true);
  for (const name of out.chosen) assert.ok(fs.existsSync(path.join(root, 'sites', name.replace('startbootstrap-', ''), 'site', 'index.html')));
  for (const tried of out.tried.filter((x) => !x.ok)) assert.ok(!fs.existsSync(path.join(root, 'sites', tried.name.replace('startbootstrap-', ''))), 'a skipped site is not kept');
});

// Found at the draw: three sites load placeholder images from other hosts. Each becomes a local
// SVG stand-in of the same size, made from its URL, the same way on every site.
import { standInFor, localizeImages } from './sites.mjs';

test('a stand-in for a placeholder image: same size, colours from the URL, a stable file name', () => {
  const d = standInFor('https://dummyimage.com/450x300/dee2e6/6c757d.jpg');
  assert.equal(d.width, 450);
  assert.equal(d.height, 300);
  assert.match(d.svg, /width="450" height="300"/);
  assert.match(d.svg, /fill="#dee2e6"/);
  assert.match(d.svg, /fill="#6c757d"/);
  assert.match(d.svg, />450×300</);
  assert.equal(d.file, standInFor('https://dummyimage.com/450x300/dee2e6/6c757d.jpg').file);
  const u = standInFor('https://source.unsplash.com/4ulffa6qoKA/1200x800');
  assert.equal(u.width, 1200);
  assert.equal(u.height, 800);
  assert.notEqual(u.file, standInFor('https://source.unsplash.com/wfh8dDlNFOk/1600x900').file);
  assert.equal(standInFor('https://example.com/photo.jpg'), null, 'an image from an unknown host has no stand-in');
});

test('localize: img src and url() in a page point at local stand-ins, written into the site', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-local-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const html = [
    '<img class="img-fluid" src="https://dummyimage.com/600x700/dee2e6/6c757d.jpg" alt="..." />',
    '<header style="background-image: url(\'https://source.unsplash.com/4ulffa6qoKA/1200x800\')"></header>',
    '<img src="https://example.com/x.png">',
    '<a href="https://startbootstrap.com/">link</a>',
  ].join('\n');
  const out = localizeImages(html, dir);
  assert.equal(out.localized.length, 2);
  assert.deepEqual(out.unknown, ['https://example.com/x.png']);
  assert.doesNotMatch(out.html, /dummyimage|unsplash/);
  assert.match(out.html, /startbootstrap\.com/, 'links stay');
  for (const rel of out.html.match(/assets\/stand-in\/[\w-]+\.svg/g)) assert.ok(fs.existsSync(path.join(dir, rel)), rel);
});

test('import also replaces known remote images with stand-ins, and lists any it could not', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-import-img-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tgz = fakePackage(root, 'startbootstrap-img', { ...GOOD, 'dist/index.html': '<img src="https://dummyimage.com/900x400/dee2e6/6c757d.jpg"><img src="https://example.com/a.png"><h1>Shop</h1>' });
  const out = importTarball(tgz, path.join(root, 'out'));
  assert.deepEqual(out.localized, ['https://dummyimage.com/900x400/dee2e6/6c757d.jpg']);
  assert.deepEqual(out.unknownImages, ['https://example.com/a.png']);
  assert.ok(fs.existsSync(path.join(root, 'out', 'site', 'assets', 'stand-in', 'dummy-900x400-dee2e6-6c757d.svg')));
});
