#!/usr/bin/env node
// Draws study 2's sites (study2/PREREGISTRATION.md, section 4): tries the
// candidates in the seeded order, keeps the first six eligible, and writes
// study2/sites/<name>/ and study2/sites/manifest.json.
//   node study2/select-sites.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chooseSites, importTarball, offlineFacts } from './sites.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITES = path.join(HERE, 'sites');
const SEED = 20261118;
const COUNT = 6;

function fetchTarball(name, work) {
  const meta = JSON.parse(execFileSync('npm', ['view', name, 'version', 'dist.integrity', '--json'], { encoding: 'utf8' }));
  const file = execFileSync('npm', ['pack', `${name}@${meta.version}`, '--pack-destination', work, '--silent'], { encoding: 'utf8' }).trim().split('\n').pop();
  return { tarball: path.join(work, file), version: meta.version, integrity: meta['dist.integrity'] };
}

// --reimport: rebuild the drawn sites from their pinned packages with the current
// importer (no new draw), and record what each looks like offline.
async function reimport(work) {
  const manifestFile = path.join(SITES, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const imported = {};
  for (const name of manifest.chosen) {
    const pinned = manifest.tried.find((t) => t.name === name);
    const meta = JSON.parse(execFileSync('npm', ['view', `${name}@${pinned.version}`, 'dist.integrity', '--json'], { encoding: 'utf8' }));
    if (meta !== pinned.integrity) throw new Error(`${name}@${pinned.version}: integrity ${meta} is not the drawn ${pinned.integrity}`);
    const file = execFileSync('npm', ['pack', `${name}@${pinned.version}`, '--pack-destination', work, '--silent'], { encoding: 'utf8' }).trim().split('\n').pop();
    const dest = path.join(SITES, name.replace(/^startbootstrap-/, ''));
    fs.rmSync(dest, { recursive: true, force: true });
    const facts = importTarball(path.join(work, file), dest);
    const offline = await offlineFacts(path.join(dest, 'site'), facts.pages);
    imported[name] = { version: pinned.version, ...facts, ...offline };
    console.log(`${name}@${pinned.version}: ${facts.localized.length} images replaced, ${facts.unknownImages.length} unknown, ${offline.remoteRequests} remote requests offline, ${offline.failedLocal.length} failed local`);
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify({ ...manifest, reimported: new Date().toISOString(), imported }, null, 2)}\n`);
}

const { names } = JSON.parse(fs.readFileSync(path.join(SITES, 'candidates.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-s2-packs-'));
if (process.argv.includes('--reimport')) {
  try {
    await reimport(work);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  process.exit(0);
}
try {
  const result = await chooseSites({ names, seed: SEED, count: COUNT, destRoot: SITES, fetchTarball: (name) => fetchTarball(name, work) });
  fs.writeFileSync(path.join(SITES, 'manifest.json'), `${JSON.stringify({ drawn: new Date().toISOString(), ...result }, null, 2)}\n`);
  for (const t of result.tried) console.log(`${t.ok ? 'KEPT   ' : 'skipped'} ${t.name}@${t.version}${t.ok ? ` (${t.pages.length} page${t.pages.length === 1 ? '' : 's'})` : `: ${t.reasons.join('; ')}`}`);
  console.log(`\nchosen: ${result.chosen.join(', ')}`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
