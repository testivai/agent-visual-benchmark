#!/usr/bin/env node
// Writes a task's patches from oracle/<id>/edits.mjs, so that no patch is typed by hand.
//
//   node tools/author.mjs            write the patches of every task
//   node tools/author.mjs t03 t07    of these tasks
//   node tools/author.mjs --check    exit 1 if a committed patch is not what its edits produce
//
// edits.mjs default-exports:
//   seed       edits that turn the clean app into the task's starting state
//   reference  edits on top of the seed (one correct solution), or 'revert' to undo the seed
//   wrong      edits on top of the seed: a fix that only hides the symptom
//   accepted   { name: edits } other correct solutions the scorer must not reject (optional)
// An edit is one of:
//   { file, find, replace }   `find` must occur exactly once (`files: [...]` for the same edit in several files)
//   { file, append }          add text at the end
//   { file, copyFrom }        replace the file with another one (path from the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPO_ROOT, makePatch, makeWorkspace, removeWorkspace, WORK_ROOT } from '../harness/workspace.mjs';

function editFile(dir, file, edit, sourceRoot) {
  const target = path.join(dir, file);
  if (!fs.existsSync(target)) throw new Error(`${file} does not exist`);
  if ('copyFrom' in edit) {
    fs.copyFileSync(path.join(sourceRoot, edit.copyFrom), target);
  } else if ('append' in edit) {
    fs.appendFileSync(target, edit.append);
  } else if ('find' in edit && 'replace' in edit) {
    const before = fs.readFileSync(target, 'utf8');
    const count = before.split(edit.find).length - 1;
    if (count === 0) throw new Error(`${file}: text not found: ${JSON.stringify(edit.find.slice(0, 80))}`);
    if (count > 1) throw new Error(`${file}: text occurs ${count} times, must be once: ${JSON.stringify(edit.find.slice(0, 80))}`);
    fs.writeFileSync(target, before.replace(edit.find, () => edit.replace));
  } else {
    throw new Error(`${file}: unknown edit ${JSON.stringify(Object.keys(edit))}`);
  }
}

export function applyEdits(dir, edits, sourceRoot = REPO_ROOT) {
  for (const edit of edits) {
    for (const file of edit.files ?? [edit.file]) editFile(dir, file, edit, sourceRoot);
  }
}

function tempPatchFile(body) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(WORK_ROOT, 'authorpatch-'));
  const file = path.join(dir, 'seed.patch');
  fs.writeFileSync(file, body);
  return file;
}

// { seed, reference, wrong, accepted: { name: patch } } as patch text
export function buildPatches(appDir, edits, sourceRoot = REPO_ROOT) {
  const seed = makePatch(appDir, (dir) => applyEdits(dir, edits.seed ?? [], sourceRoot));
  const seedFile = tempPatchFile(seed);
  const seeded = makeWorkspace({ appDir, patches: [seedFile], label: 'author' });
  try {
    const onSeed = (list) => makePatch(seeded, (dir) => applyEdits(dir, list, sourceRoot));
    const reference = edits.reference === 'revert'
      ? makePatch(seeded, (dir) => {
        fs.rmSync(path.join(dir, 'site'), { recursive: true, force: true });
        fs.cpSync(path.join(appDir, 'site'), path.join(dir, 'site'), { recursive: true });
      })
      : onSeed(edits.reference ?? []);
    return {
      seed,
      reference,
      wrong: onSeed(edits.wrong ?? []),
      accepted: Object.fromEntries(Object.entries(edits.accepted ?? {}).map(([name, list]) => [name, onSeed(list)])),
    };
  } finally {
    removeWorkspace(seeded);
    removeWorkspace(path.dirname(seedFile));
  }
}

export function authoredTasks(benchRoot) {
  const oracle = path.join(benchRoot, 'oracle');
  return fs.readdirSync(oracle).filter((id) => fs.existsSync(path.join(oracle, id, 'edits.mjs'))).sort();
}

async function patchFiles(benchRoot, id) {
  const editsFile = path.join(benchRoot, 'oracle', id, 'edits.mjs');
  const { default: edits } = await import(`${pathToFileURL(editsFile).href}?t=${fs.statSync(editsFile).mtimeMs}`);
  const patches = buildPatches(path.join(benchRoot, 'app'), edits, benchRoot);
  const files = {
    [path.join('tasks', id, 'seed.patch')]: patches.seed,
    [path.join('oracle', id, 'reference.patch')]: patches.reference,
    [path.join('oracle', id, 'wrong.patch')]: patches.wrong,
  };
  for (const [name, body] of Object.entries(patches.accepted)) {
    files[path.join('oracle', id, 'accepted', `${name}.patch`)] = body;
  }
  return files;
}

export async function writePatches(benchRoot, id) {
  const files = await patchFiles(benchRoot, id);
  const acceptedDir = path.join(benchRoot, 'oracle', id, 'accepted');
  fs.rmSync(acceptedDir, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(benchRoot, rel)), { recursive: true });
    fs.writeFileSync(path.join(benchRoot, rel), body);
  }
  return Object.keys(files);
}

// The committed patches that differ from what the edits produce.
export async function checkInSync(benchRoot, id) {
  const files = await patchFiles(benchRoot, id);
  const stale = Object.entries(files)
    .filter(([rel, body]) => !fs.existsSync(path.join(benchRoot, rel)) || fs.readFileSync(path.join(benchRoot, rel), 'utf8') !== body)
    .map(([rel]) => rel);
  const acceptedDir = path.join(benchRoot, 'oracle', id, 'accepted');
  const onDisk = fs.existsSync(acceptedDir) ? fs.readdirSync(acceptedDir).map((f) => path.join('oracle', id, 'accepted', f)) : [];
  return [...stale, ...onDisk.filter((rel) => !(rel in files)).map((rel) => `${rel} (not in edits.mjs)`)];
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const ids = args.filter((a) => !a.startsWith('--'));
  const tasks = ids.length > 0 ? ids : authoredTasks(REPO_ROOT);
  let stale = 0;
  for (const id of tasks) {
    if (check) {
      const out = await checkInSync(REPO_ROOT, id);
      stale += out.length;
      for (const rel of out) console.log(`stale: ${rel}`);
    } else {
      const written = await writePatches(REPO_ROOT, id);
      console.log(`${id}: ${written.length} patches`);
    }
  }
  if (check) console.log(stale === 0 ? `${tasks.length} tasks in sync` : `${stale} stale patch(es): run npm run author`);
  process.exit(stale === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
