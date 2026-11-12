// Commits and pushes a phase's results every few finished runs, so a long
// study loses at most the run in progress if its machine goes away. The
// commits skip CI: they hold data, not code.
import { execFileSync } from 'node:child_process';

export function shouldSave({ finished, every, last = false }) {
  if (!every) return false;
  return last || finished % every === 0;
}

function git(repoDir, args) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
}

export function saveProgress({ repoDir, resultsDir, message, trailer = '' }) {
  git(repoDir, ['add', '--', resultsDir]);
  if (git(repoDir, ['diff', '--cached', '--name-only', '--', resultsDir]).trim() === '') return { saved: false, reason: 'nothing new' };
  git(repoDir, ['commit', '-q', '-m', `${message} [skip ci]${trailer ? `\n\n${trailer}` : ''}`, '--', resultsDir]);
  try {
    git(repoDir, ['push', '-q', 'origin', 'HEAD']);
    return { saved: true };
  } catch (err) {
    return { saved: false, reason: `committed; push failed: ${String(err.stderr || err.message).trim().split('\n')[0]}` };
  }
}
