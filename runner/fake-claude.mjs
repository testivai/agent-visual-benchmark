#!/usr/bin/env node
// A stand-in for `claude -p --output-format stream-json`, for testing the
// runner without a model. It takes the same arguments, prints the same kind
// of messages, and does what FAKE_CLAUDE_MODE says:
//   apply         apply FAKE_CLAUDE_PATCH (if set) and claim DONE (or FAKE_CLAUDE_STATUS)
//   crash         exit 1 with no result
//   crash-once    crash the first time (marker in FAKE_CLAUDE_STATE), apply after that
//   hang          start a child process (pid in FAKE_CLAUDE_PIDFILE) and never finish
//   leave-server  start a child process, then finish normally, leaving it running
//   leak-key      print the API key in the final message
//   error-result  end with an error_during_execution result
//   max-turns     end with an error_max_turns result
//   touch-baseline  apply the patch, then overwrite one baseline file
//   wrong-model   report a different model than the one asked for, then work 2 s later
//   extra-tool    report WebFetch among the tools, then work 2 s later
//   plugin        report a loaded plugin, then work 2 s later
//   mcp-failed    report every MCP server as failed
// FAKE_CLAUDE_RECORD: write the arguments, cwd and environment names there.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const env = process.env;
if (args.includes('--version')) {
  process.stdout.write('0.0.0 (fake Claude Code)\n');
  process.exit(0);
}
const mode = env.FAKE_CLAUDE_MODE ?? 'apply';
const option = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const emit = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const model = option('--model') ?? 'unknown';

if (env.FAKE_CLAUDE_RECORD) {
  fs.writeFileSync(env.FAKE_CLAUDE_RECORD, JSON.stringify({ args, cwd: process.cwd(), envNames: Object.keys(env).sort() }));
}

function mcpServers(status) {
  const file = option('--mcp-config');
  if (!file) return [];
  return Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers ?? {}).map((name) => ({ name, status }));
}

// As Claude Code reports them: the --tools list, then each MCP server's tools.
function tools() {
  const base = option('--tools') ? option('--tools').split(',') : ['Bash', 'Read', 'Edit', 'Write'];
  const mcp = mcpServers('connected').flatMap((s) => [`mcp__${s.name}__get_visual_results`, `mcp__${s.name}__get_diff`]);
  return [...base, ...mcp, ...(mode === 'extra-tool' ? ['WebFetch'] : [])];
}

function startChild() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  child.unref();
  if (env.FAKE_CLAUDE_PIDFILE) fs.writeFileSync(env.FAKE_CLAUDE_PIDFILE, String(child.pid));
}

let id = 0;
function bash(command, run) {
  id += 1;
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `t${id}`, name: 'Bash', input: { command } }] } });
  let output = '';
  let isError = false;
  try {
    output = run();
  } catch (err) {
    output = String(err.message);
    isError = true;
  }
  emit({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${id}`, content: output, is_error: isError }] } });
}

function applyPatch() {
  const patch = env.FAKE_CLAUDE_PATCH;
  if (!patch || fs.readFileSync(patch, 'utf8').trim() === '') return;
  bash('git apply fix.patch', () => execFileSync('git', ['apply', patch], {
    encoding: 'utf8', env: { ...env, GIT_CEILING_DIRECTORIES: path.dirname(process.cwd()) },
  }));
}

function touchBaseline() {
  const candidates = [];
  const snapshots = path.join(process.cwd(), 'tests', 'visual.spec.ts-snapshots');
  if (fs.existsSync(snapshots)) candidates.push(...fs.readdirSync(snapshots).map((f) => path.join(snapshots, f)));
  const baselines = path.join(process.cwd(), '.testivai', 'baselines');
  if (fs.existsSync(baselines)) candidates.push(...fs.readdirSync(baselines).map((d) => path.join(baselines, d, 'screenshot.png')));
  bash('npx playwright test tests/visual.spec.ts --update-snapshots', () => {
    fs.writeFileSync(candidates[0], 'overwritten');
    return 'updated';
  });
}

function result(over = {}) {
  const cost = Number(env.FAKE_CLAUDE_COST ?? 0.123);
  emit({
    type: 'result', subtype: 'success', is_error: false, num_turns: id + 1, total_cost_usd: cost, session_id: 'fake',
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    modelUsage: { [model]: { inputTokens: 1000, outputTokens: 200, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: cost } },
    ...over,
  });
}

function finish(text) {
  emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
  result({ result: text });
}

function crash() {
  process.stderr.write('boom: the fake agent crashed\n');
  process.exit(1);
}

emit({
  type: 'system', subtype: 'init', model: mode === 'wrong-model' ? 'claude-other' : model, claude_code_version: 'fake-1.0.0',
  tools: tools(), mcp_servers: mcpServers(mode === 'mcp-failed' ? 'failed' : 'connected'),
  plugins: mode === 'plugin' ? [{ name: 'cc-plugin-privacy', path: 'builtin' }] : [], skills: [],
});

const status = env.FAKE_CLAUDE_STATUS ?? 'DONE';
const MODES = {
  apply() { applyPatch(); finish(`I made the change.\nSTATUS: ${status}`); },
  // a start the runner must refuse: the work comes 2 s after the report
  'wrong-model'() { setTimeout(MODES.apply, 2000); },
  'extra-tool'() { setTimeout(MODES.apply, 2000); },
  plugin() { setTimeout(MODES.apply, 2000); },
  'mcp-failed'() { MODES.apply(); },
  crash,
  'crash-once'() {
    if (!fs.existsSync(env.FAKE_CLAUDE_STATE)) {
      fs.writeFileSync(env.FAKE_CLAUDE_STATE, 'crashed once');
      crash();
    }
    MODES.apply();
  },
  hang() { startChild(); setInterval(() => {}, 1000); },
  'leave-server'() { startChild(); MODES.apply(); },
  'leak-key'() { finish(`My key is ${env.ANTHROPIC_API_KEY}.\nSTATUS: DONE`); process.stderr.write(`warn ${env.ANTHROPIC_API_KEY}\n`); },
  'error-result'() { result({ subtype: 'error_during_execution', is_error: true }); },
  'max-turns'() { applyPatch(); result({ subtype: 'error_max_turns', num_turns: 61 }); },
  'touch-baseline'() { applyPatch(); touchBaseline(); finish('Updated the screenshots.\nSTATUS: DONE'); },
};
MODES[mode]();
