import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSettings, buildMcpConfig, buildClaudeArgs, buildAgentEnv } from './claude.mjs';

const agent = { command: ['claude'], model: 'claude-opus-5-5', effort: null, maxTurns: 60, maxBudgetUsdPerRun: 10, timeLimitMinutes: 30 };

test('every arm may run commands and edit files; only C may use the testivai tools', () => {
  for (const arm of ['A', 'B', 'C']) {
    const s = buildSettings({ arm, benchRoot: '/b/bench', isolation: 'sandbox', allowedNetwork: ['registry.npmjs.org'] });
    for (const tool of ['Bash', 'Edit', 'Write', 'Read']) assert.ok(s.permissions.allow.includes(tool), `${arm} ${tool}`);
    assert.equal(s.permissions.allow.includes('mcp__testivai'), arm === 'C');
  }
});

test('the web tools and the benchmark directory are denied', () => {
  const s = buildSettings({ arm: 'B', benchRoot: '/b/bench', isolation: 'none', allowedNetwork: [] });
  for (const rule of ['WebFetch', 'WebSearch', 'Read(//b/bench/**)', 'Edit(//b/bench/**)']) {
    assert.ok(s.permissions.deny.includes(rule), rule);
  }
});

test('sandbox isolation: on, fails rather than run unsandboxed, registry only, benchmark unreadable', () => {
  const s = buildSettings({ arm: 'A', benchRoot: '/b/bench', isolation: 'sandbox', allowedNetwork: ['registry.npmjs.org'] });
  assert.equal(s.sandbox.enabled, true);
  assert.equal(s.sandbox.failIfUnavailable, true);
  assert.deepEqual(s.sandbox.network.allowedDomains, ['registry.npmjs.org']);
  assert.equal(s.sandbox.network.allowLocalBinding, true);
  assert.deepEqual(s.sandbox.filesystem.denyRead, ['/b/bench']);
  assert.equal(buildSettings({ arm: 'A', benchRoot: '/b/bench', isolation: 'none', allowedNetwork: [] }).sandbox, undefined);
});

test('only C gets an MCP server: the installed testivai server, rooted at the workspace', () => {
  assert.equal(buildMcpConfig({ arm: 'A', workspace: '/w', nodePath: '/n/node' }), null);
  assert.equal(buildMcpConfig({ arm: 'B', workspace: '/w', nodePath: '/n/node' }), null);
  assert.deepEqual(buildMcpConfig({ arm: 'C', workspace: '/w', nodePath: '/n/node' }), {
    mcpServers: {
      testivai: { type: 'stdio', command: '/n/node', args: ['/w/node_modules/@testivai/mcp/dist/server.js', '--root', '/w'] },
    },
  });
});

test('the command line: bare print mode, pinned model, explicit permissions, limits, prompt first', () => {
  const args = buildClaudeArgs({ agent, prompt: 'The pricing page looks off.', settingsFile: '/r/settings.json', instructionsFile: '/w/CLAUDE.md', mcpConfigFile: null });
  assert.deepEqual(args.slice(0, 3), ['--bare', '-p', 'The pricing page looks off.']);
  const pair = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(pair('--output-format'), 'stream-json');
  assert.ok(args.includes('--verbose'));
  assert.equal(pair('--model'), 'claude-opus-5-5');
  assert.equal(pair('--permission-mode'), 'dontAsk');
  assert.equal(pair('--permission-prompts'), 'none');
  assert.equal(pair('--settings'), '/r/settings.json');
  assert.equal(pair('--append-system-prompt-file'), '/w/CLAUDE.md');
  assert.equal(pair('--max-turns'), '60');
  assert.equal(pair('--max-budget-usd'), '10');
  assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(args.includes('--no-session-persistence'));
  assert.ok(!args.includes('--mcp-config'));
  assert.ok(!args.includes('--effort'));
  assert.ok(!args.includes('--fallback-model'));
});

test('C adds its MCP config; an effort level is passed only when set', () => {
  const c = buildClaudeArgs({ agent: { ...agent, effort: 'high' }, prompt: 'p', settingsFile: 's', instructionsFile: 'i', mcpConfigFile: '/r/mcp.json' });
  assert.equal(c[c.indexOf('--mcp-config') + 1], '/r/mcp.json');
  assert.equal(c[c.indexOf('--effort') + 1], 'high');
});

test('the agent environment holds only what the run needs', () => {
  const base = {
    PATH: '/usr/bin', LANG: 'en_US.UTF-8', HOME: '/home/me',
    ANTHROPIC_API_KEY: 'sk-ant-api03-xxxxxxxxxxxx', ANTHROPIC_AUTH_TOKEN: 'tok', CLAUDE_CODE_OAUTH_TOKEN: 'oauth',
    CLAUDE_CODE_SESSION_ID: 'abc', CLAUDE_CODE_CHILD_SESSION: '1', GITHUB_TOKEN: 'ghp', AWS_SECRET_ACCESS_KEY: 'x',
    HTTPS_PROXY: 'http://proxy:1', NODE_EXTRA_CA_CERTS: '/ca.pem', PORT: '9999', CI: '1',
  };
  const env = buildAgentEnv({ baseEnv: base, runDir: '/r', port: 41234, browsersPath: '/pw' });
  assert.equal(env.HOME, '/r/home');
  assert.equal(env.CLAUDE_CONFIG_DIR, '/r/home/.claude');
  assert.equal(env.TMPDIR, '/r/tmp');
  assert.equal(env.PORT, '41234');
  assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, '/pw');
  assert.equal(env.ANTHROPIC_API_KEY, 'sk-ant-api03-xxxxxxxxxxxx');
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HTTPS_PROXY, 'http://proxy:1');
  assert.equal(env.NODE_EXTRA_CA_CERTS, '/ca.pem');
  assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, '1');
  assert.equal(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  for (const name of ['ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION', 'GITHUB_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'CI']) {
    assert.equal(env[name], undefined, name);
  }
});

test('extra variables (the fake agent\'s, in tests) are added last', () => {
  const env = buildAgentEnv({ baseEnv: { PATH: '/bin' }, runDir: '/r', port: 1, browsersPath: '/pw', extraEnv: { FAKE_CLAUDE_MODE: 'crash' } });
  assert.equal(env.FAKE_CLAUDE_MODE, 'crash');
});
