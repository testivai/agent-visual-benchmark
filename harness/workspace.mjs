// Throw-away copies of the app: copy, apply patches, hash, compare.
// Copies live in <repo>/.work so Node resolves the repo's node_modules from them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORK_ROOT = path.join(REPO_ROOT, '.work');

const SKIP = new Set(['node_modules', 'test-results', 'playwright-report', '.git']);

export function copyApp(srcDir, destDir) {
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)),
  });
  return destDir;
}

// git must treat the copy as "not a repository": with the enclosing repo in
// view it would resolve patch paths against the repo root instead.
function git(cwd, args, extraEnv = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(cwd), ...extraEnv },
  });
}

export function applyPatch(dir, patchFile) {
  if (fs.readFileSync(patchFile, 'utf8').trim() === '') return;
  try {
    git(dir, ['apply', '--whitespace=nowarn', path.resolve(patchFile)]);
  } catch (err) {
    const detail = String(err.stderr || err.message).trim();
    throw new Error(`patch ${path.basename(patchFile)} (${patchFile}) does not apply: ${detail}`);
  }
}

function newWorkDir(label) {
  fs.mkdirSync(WORK_ROOT, { recursive: true });
  return fs.mkdtempSync(path.join(WORK_ROOT, `${label}-`));
}

// The patch that turns `baseDir` into what `mutate(dir)` leaves behind.
export function makePatch(baseDir, mutate) {
  const dir = copyApp(baseDir, path.join(newWorkDir('patch'), 'tree'));
  const id = ['-c', 'user.name=bench', '-c', 'user.email=bench@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=/dev/null'];
  try {
    git(dir, ['init', '-q']);
    git(dir, [...id, 'add', '-A']);
    git(dir, [...id, 'commit', '-q', '--allow-empty', '-m', 'base']);
    mutate(dir);
    git(dir, [...id, 'add', '-A']);
    return git(dir, [...id, 'diff', '--cached', '--binary', '--no-color', '--no-ext-diff', '--no-renames']);
  } finally {
    removeWorkspace(path.dirname(dir));
  }
}

export function makeWorkspace({ appDir, patches = [], label = 'ws' }) {
  const dir = copyApp(appDir, path.join(newWorkDir(label), 'app'));
  for (const patch of patches) applyPatch(dir, patch);
  return dir;
}

export function removeWorkspace(dir) {
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(WORK_ROOT + path.sep)) {
    throw new Error(`refusing to delete ${resolved}: outside ${WORK_ROOT}`);
  }
  // a workspace is <work>/<label>-xxxx/app: remove its holder too
  const holder = path.dirname(resolved) === WORK_ROOT ? resolved : path.dirname(resolved);
  const target = path.basename(resolved) === 'app' || path.basename(resolved) === 'tree' ? holder : resolved;
  fs.rmSync(target, { recursive: true, force: true });
}

export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function fileHashes(root) {
  return new Map(listFiles(root).map((rel) => [rel, sha(fs.readFileSync(path.join(root, rel)))]));
}

export function hashTree(root) {
  const h = crypto.createHash('sha256');
  for (const [rel, digest] of fileHashes(root)) h.update(`${rel}\0${digest}\n`);
  return h.digest('hex');
}

export function diffTrees(rootA, rootB) {
  const a = fileHashes(rootA);
  const b = fileHashes(rootB);
  const out = [];
  for (const rel of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    if (!b.has(rel)) out.push({ path: rel, change: 'removed' });
    else if (!a.has(rel)) out.push({ path: rel, change: 'added' });
    else if (a.get(rel) !== b.get(rel)) out.push({ path: rel, change: 'changed' });
  }
  return out;
}
