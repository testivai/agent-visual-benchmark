// A temporary directory for the length of some work, removed afterwards even
// when the work throws. (A failed template build once left a copy of the clean
// app in the temporary directory, where the pilots' agents found it.)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function withTempDir(prefix, work) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await work(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
