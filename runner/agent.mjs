// Starts the agent, enforces the time limit, keeps a scrubbed transcript, and
// stops everything the agent started when it ends.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { scrub } from './scrub.mjs';

const STDERR_TAIL = 8000;

function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    // the group is already gone
  }
}

function initOf(line) {
  try {
    const m = JSON.parse(line);
    return m.type === 'system' && m.subtype === 'init' ? m : null;
  } catch {
    return null;
  }
}

// onStartup(init) returns the problems with Claude Code's startup report; if
// there are any, the run is stopped at once (stoppedAtStartup lists them).
export function runAgent({ command, args, cwd, env, timeLimitMs, transcriptFile, secrets = [], killGraceMs = 10000, onStartup = () => [] }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const out = fs.openSync(transcriptFile, 'w');
    // detached: the agent leads its own process group, so the whole group
    // (servers, browsers) can be stopped at once
    const child = spawn(command[0], [...command.slice(1), ...args], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let pending = '';
    let stderr = '';
    let timedOut = false;
    let stoppedAtStartup = null;
    let sawStartup = false;
    const watch = (line) => {
      if (sawStartup) return;
      const init = initOf(line);
      if (!init) return;
      sawStartup = true;
      const problems = onStartup(init);
      if (problems.length > 0) {
        stoppedAtStartup = problems;
        killGroup(child.pid, 'SIGKILL');
      }
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        watch(line);
        const clean = `${scrub(line, secrets)}\n`;
        stdout += clean;
        fs.writeSync(out, clean);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-STDERR_TAIL); });

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid, 'SIGTERM');
      setTimeout(() => killGroup(child.pid, 'SIGKILL'), killGraceMs).unref();
    }, timeLimitMs);

    child.on('exit', () => killGroup(child.pid, 'SIGKILL'));
    child.on('error', (err) => {
      clearTimeout(timer);
      fs.closeSync(out);
      reject(err);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (pending) {
        const clean = scrub(pending, secrets);
        stdout += clean;
        fs.writeSync(out, clean);
      }
      fs.closeSync(out);
      resolve({ exitCode, signal, timedOut, stoppedAtStartup, seconds: (Date.now() - started) / 1000, stdout, stderrTail: scrub(stderr, secrets) });
    });
  });
}
