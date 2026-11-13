import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer } from './static-server.mjs';
import { WORK_ROOT, removeWorkspace } from './workspace.mjs';

function site(files) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(WORK_ROOT, 'srv-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

test('serves files with the right content type, and index.html for a directory', async (t) => {
  const dir = site({
    'site/index.html': '<h1>home</h1>',
    'site/css/a.css': 'a{}',
    'site/fonts/f.woff2': Buffer.from([1, 2, 3]),
    'site/img/i.svg': '<svg/>',
  });
  const server = await startStaticServer(path.join(dir, 'site'));
  t.after(async () => { await server.close(); removeWorkspace(dir); });

  const home = await fetch(`${server.url}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.equal(await home.text(), '<h1>home</h1>');

  const css = await fetch(`${server.url}/css/a.css?v=1`);
  assert.match(css.headers.get('content-type'), /text\/css/);
  assert.equal(css.headers.get('cache-control'), 'no-store');

  const font = await fetch(`${server.url}/fonts/f.woff2`);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  assert.deepEqual([...new Uint8Array(await font.arrayBuffer())], [1, 2, 3]);

  assert.match((await fetch(`${server.url}/img/i.svg`)).headers.get('content-type'), /image\/svg\+xml/);
});

test('a missing file is a 404', async (t) => {
  const dir = site({ 'site/index.html': 'x' });
  const server = await startStaticServer(path.join(dir, 'site'));
  t.after(async () => { await server.close(); removeWorkspace(dir); });
  assert.equal((await fetch(`${server.url}/nope.css`)).status, 404);
});

test('never serves a file outside the root', async (t) => {
  const dir = site({ 'site/index.html': 'x', 'secret.txt': 'oracle' });
  const server = await startStaticServer(path.join(dir, 'site'));
  t.after(async () => { await server.close(); removeWorkspace(dir); });
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/css/../../secret.txt']) {
    const res = await fetch(`${server.url}${p}`);
    assert.notEqual(res.status, 200, p);
    assert.doesNotMatch(await res.text(), /oracle/, p);
  }
});

test('two servers get different ports', async (t) => {
  const dir = site({ 'site/index.html': 'x' });
  const a = await startStaticServer(path.join(dir, 'site'));
  const b = await startStaticServer(path.join(dir, 'site'));
  t.after(async () => { await a.close(); await b.close(); removeWorkspace(dir); });
  assert.notEqual(a.port, b.port);
});
