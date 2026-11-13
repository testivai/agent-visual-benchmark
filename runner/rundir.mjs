// Where each run's directory lives: outside the system temporary directory and
// the home directory, which the agent may not read (they hold other programs'
// files, and a pilot's agents found leftovers there; docs/pilot-isolation-breach.md).
// One root holds only run directories; each names the process that owns it, and
// one whose owner is gone is removed before the next run starts.
import fs from 'node:fs';
import path from 'node:path';

export const defaultRunRoot = (env = process.env) => env.AVB_RUN_ROOT || '/var/tmp/avb-runs';
export const RUN_ROOT = defaultRunRoot();

const OWNER = '.owner';

// Alive and not a zombie (a container can keep finished processes as zombies).
export function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch (err) {
    return err.code === 'EPERM';
  }
  const file = `/proc/${pid}/stat`;
  if (!fs.existsSync(file)) return true;
  const stat = fs.readFileSync(file, 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
}

function ownerOf(dir) {
  const file = path.join(dir, OWNER);
  return fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8').trim()) : null;
}

export function removeStaleRunDirs(root) {
  if (!fs.existsSync(root)) return [];
  const removed = [];
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name);
    if (processAlive(ownerOf(dir))) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    removed.push(dir);
  }
  return removed;
}

export function makeRunDir(root = RUN_ROOT) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  removeStaleRunDirs(root);
  const dir = fs.mkdtempSync(path.join(root, 'avb-'));
  fs.writeFileSync(path.join(dir, OWNER), `${process.pid}\n`);
  return dir;
}
