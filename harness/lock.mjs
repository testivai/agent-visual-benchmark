// A lock between processes on one machine: a directory next to `file`.
// A lock older than `staleMs` is taken over (its holder died).
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function withLock(file, fn, { staleMs = 30 * 60 * 1000, waitMs = 60 * 60 * 1000 } = {}) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let waited = 0; ; waited += 250) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > staleMs) fs.rmSync(lock, { recursive: true, force: true });
      if (waited > waitMs) throw new Error(`timed out waiting for ${lock}`);
      await sleep(250);
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
