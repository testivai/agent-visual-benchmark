import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ARMS, PROMPT, armFilesDir, instructionsFor, assembleApp, siteDir, SITES } from './arms.mjs';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { visualLine } from '../../runner/arms.mjs';
import { freePort } from '../../harness/run-specs.mjs';
import { startStaticServer } from '../../harness/static-server.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const json = (...p) => JSON.parse(read(...p));
const study1 = (arm, file) => path.join(REPO_ROOT, 'arms', arm, 'files', file);

test('study 2 has arms B and C, with study 1\'s instruction lines', () => {
  assert.deepEqual(ARMS, ['B', 'C']);
  for (const arm of ARMS) assert.ok(instructionsFor(arm).includes(visualLine(arm)), arm);
  const [b, c] = ARMS.map(instructionsFor);
  assert.equal(b.replace(visualLine('B'), ''), c.replace(visualLine('C'), ''), 'the arms differ by their one line only');
  assert.ok(!b.includes('{{'), 'no placeholder left');
});

test('the instructions and prompt name no category, no study, no tool beyond the arm\'s', () => {
  assert.equal(PROMPT, 'The site looks different since the last change. Can you take a look and fix it?');
  for (const arm of ARMS) {
    const text = instructionsFor(arm);
    for (const word of ['oracle', 'benchmark', 'study', 'drift', 'mutation', 'seed', 'baseline drift', 'Acme']) {
      assert.ok(!text.toLowerCase().includes(word.toLowerCase()), `${arm}: ${word}`);
    }
  }
});

const filesUnder = (root) => {
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : out.push(path.relative(root, path.join(d, e.name)))));
  walk(root);
  return out.sort();
};

test('each arm has the same files as in study 1, hidden ones included; TestivAI\'s settings are study 1\'s', () => {
  for (const arm of ARMS) assert.deepEqual(filesUnder(armFilesDir(arm)), filesUnder(path.join(REPO_ROOT, 'arms', arm, 'files')), arm);
  assert.equal(read(armFilesDir('C'), '.testivai', 'config.json'), read(study1('C', '.testivai/config.json')));
});

test('the packages are study 1\'s exactly; only the project\'s name and description differ', () => {
  for (const arm of ARMS) {
    const pkg = json(armFilesDir(arm), 'package.json');
    const old = json(study1(arm, 'package.json'));
    assert.deepEqual(pkg.devDependencies, old.devDependencies, arm);
    assert.deepEqual({ ...pkg, name: null, description: null }, { ...old, name: null, description: null }, arm);
    assert.equal(pkg.name, 'website');
    const lock = json(armFilesDir(arm), 'package-lock.json');
    const oldLock = json(study1(arm, 'package-lock.json'));
    const strip = (l) => ({ ...l, name: null, packages: { ...l.packages, '': { ...l.packages[''], name: null, description: null } } });
    assert.deepEqual(strip(lock), strip(oldLock), arm);
  }
});

test('the Playwright configs are study 1\'s without the functional tests; the specs are study 1\'s for one page', () => {
  for (const arm of ARMS) {
    const config = read(armFilesDir(arm), 'playwright.config.ts');
    const old = read(study1(arm, 'playwright.config.ts'));
    const kept = old.split('\n').filter((l) => !l.includes("name: 'functional'")).join('\n')
      .replace("import { defineConfig, devices } from '@playwright/test';", "import { defineConfig } from '@playwright/test';");
    assert.equal(config, kept, arm);
    const spec = read(armFilesDir(arm), 'tests', 'visual.spec.ts');
    const oldSpec = read(study1(arm, 'tests/visual.spec.ts'));
    const body = (s) => s.slice(s.indexOf('for (const'));
    assert.equal(body(spec), body(oldSpec), `${arm}: the test itself is the same`);
    assert.match(spec, /const PAGES = \[\n {2}\['home', '\/'\],\n\];/);
  }
});

test('every drawn site is one page, index.html, which the specs\' one page serves', () => {
  const manifest = json(REPO_ROOT, 'study2', 'sites', 'manifest.json');
  assert.equal(SITES.length, 6);
  for (const name of manifest.chosen) assert.deepEqual(manifest.imported[name].pages, ['index.html'], name);
  for (const site of SITES) assert.ok(fs.existsSync(path.join(siteDir(site), 'index.html')), site);
});

const get = (port, url) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: url }, (res) => {
    res.resume();
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] }));
  }).on('error', reject);
});

async function waitForServer(port) {
  for (let i = 0; i < 50; i++) {
    try {
      return await get(port, '/');
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('the server did not start');
}

test('the assembled app serves every file of the site as the oracle\'s server does', async () => {
  await withTempDir('avb-s2-app-', async (dir) => {
    for (const site of SITES) {
      const app = path.join(dir, site);
      assembleApp({ site, arm: 'C', dest: app });
      assert.ok(fs.existsSync(path.join(app, 'server.js')) && fs.existsSync(path.join(app, 'playwright.config.ts')));
      assert.ok(!fs.existsSync(path.join(app, 'CLAUDE.md')), 'instructions are written with the workspace, not the template');
      const files = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
      walk(path.join(app, 'site'));
      const port = await freePort();
      const server = spawn(process.execPath, ['server.js'], { cwd: app, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
      const oracle = await startStaticServer(path.join(app, 'site'));
      try {
        await waitForServer(port);
        for (const file of files) {
          const url = `/${path.relative(path.join(app, 'site'), file).split(path.sep).join('/')}`;
          const [mine, theirs] = await Promise.all([get(port, url), get(oracle.port, url)]);
          assert.deepEqual(mine, theirs, `${site} ${url}`);
          assert.equal(mine.status, 200);
          assert.notEqual(mine.type, 'application/octet-stream', `${site} ${url}`);
        }
      } finally {
        server.kill();
        await oracle.close();
      }
    }
  });
});
