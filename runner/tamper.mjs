// Did the agent change what it was not allowed to change? Tests, baselines,
// tool configuration and installed packages are protected: editing, deleting
// or adding to them makes the run a failure, whatever the scorer says.
// New test files and scratch files are allowed and recorded.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Written by running the tests; never compared.
const OUTPUTS = ['test-results/', 'playwright-report/', 'visual-report/', '.testivai/temp/', '.git/'];

// Placeholders Claude Code's sandbox creates in the working directory (found
// in a real run, docs/phase0-findings.md). Not the agent's work.
export const SANDBOX_PLACEHOLDERS = ['.bashrc', '.bash_profile', '.profile', '.zshrc', '.zprofile', '.gitconfig', '.gitmodules',
  '.ripgreprc', '.mcp.json', '.claude/', '.idea/', '.vscode/'];

const isPlaceholder = (rel) => SANDBOX_PLACEHOLDERS.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
const PROTECTED_FILES = ['playwright.config.ts', 'package.json', 'package-lock.json'];
const PROTECTED_DIRS = ['tests/', 'node_modules/', '.testivai/'];
// Inside these, even a new file is tampering.
const SEALED = [/-snapshots\//, /^\.testivai\//, /^node_modules\//];

const isOutput = (rel) => OUTPUTS.some((o) => rel.startsWith(o)) || isPlaceholder(rel);

export function isProtected(rel) {
  if (isOutput(rel)) return false;
  return PROTECTED_FILES.includes(rel) || PROTECTED_DIRS.some((d) => rel.startsWith(d));
}

export function snapshotFiles(root) {
  const out = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (isOutput(entry.isDirectory() ? `${rel}/` : rel)) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.set(rel, crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
    }
  };
  walk(root);
  return out;
}

function changes(before, after) {
  const out = [];
  for (const rel of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    if (!after.has(rel)) out.push({ rel, kind: 'removed' });
    else if (!before.has(rel)) out.push({ rel, kind: 'added' });
    else if (before.get(rel) !== after.get(rel)) out.push({ rel, kind: 'changed' });
  }
  return out;
}

const isTamper = ({ rel, kind }) => isProtected(rel) && (kind !== 'added' || SEALED.some((re) => re.test(rel)));

export function tamperCheck(before, after) {
  const all = changes(before, after);
  const label = ({ rel, kind }) => `${kind}: ${rel}`;
  const tamper = all.filter(isTamper);
  const site = all.filter((c) => c.rel.startsWith('site/'));
  const other = all.filter((c) => !c.rel.startsWith('site/') && !isTamper(c));
  return {
    tampered: tamper.length > 0,
    tamperPaths: tamper.map(label),
    siteChanges: site.map(label),
    otherChanges: other.map(label),
  };
}
