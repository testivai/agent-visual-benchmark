// Study 2's sites: which ones are tried, in what order, what is stripped from
// them so they render with no network, and which are eligible
// (study2/PREREGISTRATION.md, section 4). No person picks a site: the order
// comes from a seed, and the eligibility rule is code.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { shuffle } from '../runner/rng.mjs';
import { startStaticServer } from '../harness/static-server.mjs';

const MAX_PAGES = 6;

// The order sites are tried in: the sorted names, shuffled with the seed.
export function selectionOrder(names, seed) {
  return shuffle([...names].sort(), seed);
}

const REMOTE = '(?:https?:)?\\/\\/';
const REMOTE_TAG = new RegExp(
  `<link\\b[^>]*\\bhref=["'](${REMOTE}[^"']+)["'][^>]*>\\s*|<script\\b[^>]*\\bsrc=["'](${REMOTE}[^"']+)["'][^>]*>\\s*<\\/script>\\s*`,
  'gi',
);

// Removes <link> and <script> tags that load from another host. Plain links
// (<a href>) are not resources and stay.
export function stripRemoteHtml(html) {
  const removed = [];
  const out = html.replace(REMOTE_TAG, (_, link, script) => {
    removed.push(link ?? script);
    return '';
  });
  return { html: out, removed };
}

const REMOTE_IMPORT = new RegExp(`@import\\s+(?:url\\(\\s*)?["']?(${REMOTE}[^"')\\s]+)["']?\\s*\\)?[^;]*;\\s*`, 'gi');
const REMOTE_URL = new RegExp(`url\\(\\s*["']?${REMOTE}`, 'gi');

// Removes @imports from another host; counts any other remote url() and leaves
// it as it is (a site with one left is not eligible).
export function stripRemoteCss(css) {
  const removed = [];
  const out = css.replace(REMOTE_IMPORT, (_, url) => {
    removed.push(url);
    return '';
  });
  return { css: out, removed, remoteLeft: (out.match(REMOTE_URL) ?? []).length };
}

// The pages captured: index.html first, then the other .html files by name, at most six.
export function sitePages(dir) {
  const html = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && fs.statSync(path.join(dir, f)).isFile()).sort();
  const rest = html.filter((f) => f !== 'index.html');
  return [...(html.includes('index.html') ? ['index.html'] : []), ...rest].slice(0, MAX_PAGES);
}

// facts: { name, pages, remoteLeft, failedLocal, textChars }
export function eligibility(facts) {
  const reasons = [];
  if (/admin/.test(facts.name)) reasons.push('an admin dashboard');
  if (facts.pages.length === 0) reasons.push('no built page');
  if (facts.remoteLeft > 0) reasons.push(`${facts.remoteLeft} remote url() left in its CSS`);
  if (facts.failedLocal.length > 0) reasons.push(`a local request failed: ${facts.failedLocal.slice(0, 3).join(', ')}`);
  if (facts.textChars === 0) reasons.push('no visible text offline');
  return { ok: reasons.length === 0, reasons };
}

function filesUnder(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return filesUnder(full, ext);
    return e.name.endsWith(ext) ? [full] : [];
  });
}

// Strips every page and stylesheet of a site in place; returns what was removed
// and how many remote url() are left.
function stripSite(siteDir) {
  const removed = [];
  let remoteLeft = 0;
  for (const file of filesUnder(siteDir, '.html')) {
    const out = stripRemoteHtml(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, out.html);
    removed.push(...out.removed);
  }
  for (const file of filesUnder(siteDir, '.css')) {
    const out = stripRemoteCss(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, out.css);
    removed.push(...out.removed);
    remoteLeft += out.remoteLeft;
  }
  return { removed, remoteLeft };
}

// A package as `npm pack` makes it: the built site (package/dist) goes to
// <dest>/site, its licence to <dest>/LICENSE. No dist, no pages.
export function importTarball(tarball, dest) {
  const work = fs.mkdtempSync(path.join(path.dirname(dest), '.import-'));
  try {
    execFileSync('tar', ['xzf', tarball, '-C', work]);
    const dist = path.join(work, 'package', 'dist');
    fs.mkdirSync(dest, { recursive: true });
    const license = path.join(work, 'package', 'LICENSE');
    if (fs.existsSync(license)) fs.copyFileSync(license, path.join(dest, 'LICENSE'));
    if (!fs.existsSync(dist)) return { pages: [], removed: [], remoteLeft: 0 };
    const site = path.join(dest, 'site');
    fs.cpSync(dist, site, { recursive: true });
    return { pages: sitePages(site), ...stripSite(site) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const shortName = (name) => name.replace(/^startbootstrap-/, '');

async function tryOne(name, { destRoot, fetchTarball }) {
  const dest = path.join(destRoot, shortName(name));
  const pkg = fetchTarball(name);
  const imported = importTarball(pkg.tarball, dest);
  const offline = imported.pages.length > 0
    ? await offlineFacts(path.join(dest, 'site'), imported.pages)
    : { failedLocal: [], remoteRequests: 0, textChars: 0 };
  const verdict = eligibility({ name, ...imported, ...offline });
  if (!verdict.ok) fs.rmSync(dest, { recursive: true, force: true });
  return { name, version: pkg.version, integrity: pkg.integrity, ...verdict, pages: imported.pages, removed: imported.removed, remoteRequestsAfterStrip: offline.remoteRequests };
}

// Tries sites in the seeded order and keeps the first `count` eligible ones.
// fetchTarball(name) -> { tarball, version, integrity }.
export async function chooseSites({ names, seed, count, destRoot, fetchTarball }) {
  fs.mkdirSync(destRoot, { recursive: true });
  const tried = [];
  for (const name of selectionOrder(names, seed)) {
    if (tried.filter((x) => x.ok).length >= count) break;
    tried.push(await tryOne(name, { destRoot, fetchTarball }));
  }
  return { seed, count, order: selectionOrder(names, seed), tried, chosen: tried.filter((x) => x.ok).map((x) => x.name) };
}

const isLocal = (url) => ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);

// Loads each page in Chromium with every request off this machine refused:
// which local requests failed, how many remote ones were asked for, how much text shows.
export async function offlineFacts(dir, pages) {
  const server = await startStaticServer(dir);
  const browser = await chromium.launch();
  const failedLocal = new Set();
  let remoteRequests = 0;
  let textChars = 0;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route('**/*', (route) => {
      if (isLocal(route.request().url())) return route.continue();
      remoteRequests += 1;
      return route.abort();
    });
    const page = await context.newPage();
    page.on('response', (r) => { if (isLocal(r.url()) && r.status() >= 400) failedLocal.add(new URL(r.url()).pathname); });
    page.on('requestfailed', (r) => { if (isLocal(r.url())) failedLocal.add(new URL(r.url()).pathname); });
    for (const name of pages) {
      await page.goto(`${server.url}/${name}`, { waitUntil: 'load', timeout: 20000 });
      textChars += (await page.evaluate(() => document.body?.innerText ?? '')).trim().length;
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return { failedLocal: [...failedLocal].sort(), remoteRequests, textChars };
}
