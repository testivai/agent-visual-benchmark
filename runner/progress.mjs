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

const firstLine = (err) => String(err.stderr || err.message).trim().split('\n')[0];

// Never throws: a save that fails is reported, and the next one picks up what it missed.
export function saveProgress({ repoDir, resultsDir, message, trailer = '' }) {
  try {
    git(repoDir, ['add', '--', resultsDir]);
    if (git(repoDir, ['diff', '--cached', '--name-only', '--', resultsDir]).trim() === '') return { saved: false, reason: 'nothing new' };
    git(repoDir, ['commit', '-q', '-m', `${message} [skip ci]${trailer ? `\n\n${trailer}` : ''}`, '--', resultsDir]);
  } catch (err) {
    return { saved: false, reason: `not saved: ${firstLine(err)}` };
  }
  try {
    git(repoDir, ['push', '-q', 'origin', 'HEAD']);
    return { saved: true };
  } catch (err) {
    return { saved: false, reason: `committed; push failed: ${firstLine(err)}` };
  }
}
