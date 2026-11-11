// Everything the scorer needs to know about one task, measured on this machine
// and cached: the clean app, the seeded app, and the app after each known
// correct solution. From these it derives what the task was allowed to change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, makeWorkspace, removeWorkspace, hashTree, diffTrees } from '../../harness/workspace.mjs';
import { startStaticServer } from '../../harness/static-server.mjs';
import { captureSnapshot } from './capture.mjs';
import { buildScope } from './compare.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'oracle');
const sha = (...parts) => {
  const h = crypto.createHash('sha256');
  for (const part of parts) h.update(part).update('\0');
  return h.digest('hex').slice(0, 20);
};
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// A change to how the site is measured must not reuse old measurements.
const measurementVersion = () => sha(
  read(path.join(HERE, 'capture.mjs')),
  read(path.join(HERE, 'views.mjs')),
  read(path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'package.json')),
);

async function withLock(file, fn) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let waited = 0; ; waited += 250) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const age = Date.now() - fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs;
      if (age > 10 * 60 * 1000) fs.rmSync(lock, { recursive: true, force: true });
      if (waited > 10 * 60 * 1000) throw new Error(`timed out waiting for ${lock}`);
      await sleep(250);
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

async function cached(name, compute) {
  const file = path.join(CACHE_DIR, `${name}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return withLock(file, async () => {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const value = await compute();
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
    fs.renameSync(`${file}.tmp`, file);
    return value;
  });
}

async function measureApp(browser, appDir, patches) {
  const ws = makeWorkspace({ appDir, patches, label: 'ctx' });
  const server = await startStaticServer(path.join(ws, 'site'));
  try {
    return await captureSnapshot(browser, server.url);
  } finally {
    await server.close();
    removeWorkspace(ws);
  }
}

export function taskFiles(benchRoot, taskId) {
  const taskDir = path.join(benchRoot, 'tasks', taskId);
  const oracleDir = path.join(benchRoot, 'oracle', taskId);
  const acceptedDir = path.join(oracleDir, 'accepted');
  const accepted = fs.existsSync(acceptedDir)
    ? fs.readdirSync(acceptedDir).filter((f) => f.endsWith('.patch')).sort().map((f) => path.join(acceptedDir, f))
    : [];
  return {
    task: JSON.parse(fs.readFileSync(path.join(taskDir, 'task.json'), 'utf8')),
    seed: path.join(taskDir, 'seed.patch'),
    solutions: [path.join(oracleDir, 'reference.patch'), ...accepted],
  };
}

// { task, clean, seeded, solutions, scope }
export async function getTaskContext(browser, benchRoot, taskId) {
  const appDir = path.join(benchRoot, 'app');
  const { task, seed, solutions } = taskFiles(benchRoot, taskId);
  const cleanKey = sha(hashTree(path.join(appDir, 'site')), measurementVersion());
  const taskKey = sha(cleanKey, task.type, read(seed), ...solutions.map(read));

  const clean = await cached(`clean-${cleanKey}`, () => measureApp(browser, appDir, []));
  const states = await cached(`${taskId}-${taskKey}`, async () => ({
    seeded: await measureApp(browser, appDir, [seed]),
    solutions: await Promise.all(solutions.map((patch) => measureApp(browser, appDir, [seed, patch]))),
  }));
  const scope = buildScope({ type: task.type, clean, seeded: states.seeded, solutions: states.solutions });
  return { task, clean, seeded: states.seeded, solutions: states.solutions, scope };
}

// Decoys: files under site/ that differ from the seeded app.
export function sourceChanges(benchRoot, taskId, appDir) {
  const { seed } = taskFiles(benchRoot, taskId);
  const seeded = makeWorkspace({ appDir: path.join(benchRoot, 'app'), patches: [seed], label: 'ctx' });
  try {
    return diffTrees(path.join(seeded, 'site'), path.join(appDir, 'site'));
  } finally {
    removeWorkspace(seeded);
  }
}
