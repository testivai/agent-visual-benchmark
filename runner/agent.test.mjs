import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runAgent } from './agent.mjs';
import { parseStream } from './transcript.mjs';

const FAKE = [process.execPath, path.resolve('runner/fake-claude.mjs')];
const KEY = 'sk-ant-api03-TESTKEY-not-real-0123456789';

function setup(t, files = { 'site/a.css': 'a { color: red; }\n' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-agent-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ws = path.join(dir, 'project');
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), body);
  }
  return { dir, ws, transcript: path.join(dir, 'transcript.jsonl') };
}

// Running, as opposed to gone or a zombie: a killed process whose parent is
// gone stays a zombie where PID 1 does not reap orphans (some containers).
function isRunning(pid) {
  if (fs.existsSync('/proc')) {
    try {
      return !/State:\s+Z/.test(fs.readFileSync(`/proc/${pid}/status`, 'utf8'));
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const env = (extra) => ({ PATH: process.env.PATH, ANTHROPIC_API_KEY: KEY, ...extra });
const args = ['--bare', '-p', 'Fix the page.', '--output-format', 'stream-json', '--verbose', '--model', 'claude-test-1'];

test('a run that edits the workspace and ends with a result', async (t) => {
  const { dir, ws, transcript } = setup(t);
  const patch = path.join(dir, 'fix.patch');
  fs.writeFileSync(patch, ['diff --git a/site/a.css b/site/a.css', '--- a/site/a.css', '+++ b/site/a.css', '@@ -1 +1 @@', '-a { color: red; }', '+a { color: blue; }', ''].join('\n'));
  const r = await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_PATCH: patch }), timeLimitMs: 30000, transcriptFile: transcript, secrets: [KEY] });
  assert.equal(r.exitCode, 0);
  assert.equal(r.timedOut, false);
  assert.equal(fs.readFileSync(path.join(ws, 'site/a.css'), 'utf8'), 'a { color: blue; }\n');
  const parsed = parseStream(r.stdout);
  assert.equal(parsed.hasResult, true);
  assert.equal(parsed.model, 'claude-test-1');
  assert.match(parsed.finalText, /STATUS: DONE/);
  assert.equal(fs.readFileSync(transcript, 'utf8'), r.stdout);
});

test('the transcript on disk and in memory never holds the key', async (t) => {
  const { ws, transcript } = setup(t);
  const r = await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'leak-key' }), timeLimitMs: 30000, transcriptFile: transcript, secrets: [KEY] });
  assert.ok(!r.stdout.includes(KEY));
  assert.ok(!fs.readFileSync(transcript, 'utf8').includes(KEY));
  assert.match(fs.readFileSync(transcript, 'utf8'), /\[REDACTED\]/);
  assert.ok(!r.stderrTail.includes(KEY));
});

test('a crash is an exit code and no result', async (t) => {
  const { ws, transcript } = setup(t);
  const r = await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'crash' }), timeLimitMs: 30000, transcriptFile: transcript, secrets: [KEY] });
  assert.notEqual(r.exitCode, 0);
  assert.equal(parseStream(r.stdout).hasResult, false);
  assert.match(r.stderrTail, /boom/);
});

test('the time limit stops the agent and everything it started', async (t) => {
  const { dir, ws, transcript } = setup(t);
  const pidFile = path.join(dir, 'child.pid');
  const started = Date.now();
  const r = await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'hang', FAKE_CLAUDE_PIDFILE: pidFile }), timeLimitMs: 2000, killGraceMs: 1000, transcriptFile: transcript, secrets: [KEY] });
  assert.equal(r.timedOut, true);
  assert.ok(Date.now() - started < 15000);
  assert.equal(parseStream(r.stdout).hasResult, false);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  await new Promise((done) => setTimeout(done, 300));
  assert.equal(isRunning(pid), false, 'the child the agent started is stopped');
});

test('the running check sees a live process as running', () => {
  assert.equal(isRunning(process.pid), true);
});

test('processes the agent leaves behind are stopped when it exits', async (t) => {
  const { dir, ws, transcript } = setup(t);
  const pidFile = path.join(dir, 'server.pid');
  const r = await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'leave-server', FAKE_CLAUDE_PIDFILE: pidFile }), timeLimitMs: 30000, transcriptFile: transcript, secrets: [KEY] });
  assert.equal(r.exitCode, 0);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  await new Promise((done) => setTimeout(done, 300));
  assert.equal(isRunning(pid), false);
});

test('the fake records the arguments and environment it was given', async (t) => {
  const { dir, ws, transcript } = setup(t);
  const record = path.join(dir, 'args.json');
  await runAgent({ command: FAKE, args, cwd: ws, env: env({ FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_RECORD: record }), timeLimitMs: 30000, transcriptFile: transcript, secrets: [KEY] });
  const seen = JSON.parse(fs.readFileSync(record, 'utf8'));
  assert.deepEqual(seen.args, args);
  assert.equal(seen.cwd, fs.realpathSync(ws));
  assert.deepEqual(seen.envNames, Object.keys(env({ FAKE_CLAUDE_MODE: 'apply', FAKE_CLAUDE_RECORD: record })).sort(),
    'the agent gets exactly the environment it was given, nothing from the runner');
});

test('git is there for the fake to apply patches', () => {
  assert.match(execFileSync('git', ['--version'], { encoding: 'utf8' }), /git/);
});
