// The three arms of the study. They differ only in the files under
// arms/<arm>/files/ and in one line of the instructions every arm gets.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../harness/workspace.mjs';

const ARMS_DIR = path.join(REPO_ROOT, 'arms');

export const ARMS = {
  A: { name: 'blind', visual: null },
  B: { name: 'pixel', visual: 'pixel' },
  C: { name: 'testivai', visual: 'testivai' },
};

// Where each tool keeps its approved baselines in a workspace.
export const BASELINE_DIRS = {
  A: [],
  B: ['tests/visual.spec.ts-snapshots'],
  C: ['.testivai/baselines'],
};

function walk(dir, root = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full, root) : [path.relative(root, full).split(path.sep).join('/')];
  });
}

export function armFilesDir(arm) {
  return path.join(ARMS_DIR, arm, 'files');
}

export function armFiles(arm) {
  return walk(armFilesDir(arm)).sort();
}

export function visualLine(arm) {
  const file = path.join(ARMS_DIR, arm, 'instructions-line.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

// The CLAUDE.md of a workspace: the base text, with the arm's line or without it.
export function instructionsFor(arm) {
  const base = fs.readFileSync(path.join(ARMS_DIR, 'base', 'CLAUDE.md'), 'utf8');
  const line = visualLine(arm);
  return line ? base.replace('{{VISUAL_LINE}}', line) : base.replace('{{VISUAL_LINE}}\n', '');
}
