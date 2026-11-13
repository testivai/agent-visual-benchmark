import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSettings, buildMcpConfig, buildClaudeArgs, buildAgentEnv, hiddenRoot, caFiles, BUILTIN_PLUGINS, BASE_TOOLS } from './claude.mjs';

const subscription = { command: ['claude'], id: 'sonnet', model: 'claude-sonnet-5-5', provider: 'anthropic-subscription', effort: null, maxTurns: 60, maxBudgetUsdPerRun: 10, timeLimitMinutes: 30 };
const apiKey = { ...subscription, id: 'opus-key', model: 'claude-opus-5-5', provider: 'anthropic-api-key' };
const deepseek = {
  ...subscription, id: 'deepseek', model: 'deepseek-flash', provider: 'anthropic-compatible', baseUrl: 'https://api.deepseek.com/anthropic',
  authTokenEnv: 'DEEPSEEK_API_KEY', pricesPerMillionUsd: { input: 0.3, cacheRead: 0.006, cacheWrite: 0.3, output: 1.2 },
};
const RUN = '/var/tmp/avb-runs/avb-x1';
const settingsFor = (arm, over = {}) => buildSettings({
  arm, benchRoot: '/home/me/work/bench', homeDir: '/home/me', tmpDir: '/tmp', runRoot: '/var/tmp/avb-runs', runDir: RUN,
  isolation: 'sandbox', allowedNetwork: ['registry.npmjs.org'], readNeeds: [], ...over,
});

test('every arm may use Bash, and Read and Edit inside its own run directory only; only C may use the testivai tools', () => {
  assert.deepEqual(BASE_TOOLS, ['Bash', 'Edit', 'Read']);
  for (const arm of ['A', 'B', 'C']) {
    assert.deepEqual(settingsFor(arm).permissions.allow, ['Bash', `Read(/${RUN}/**)`, `Edit(/${RUN}/**)`, ...(arm === 'C' ? ['mcp__testivai'] : [])]);
  }
});

// docs/pilot-isolation-breach.md: the home directory and the temporary directory held other
// programs' files (the study session's transcript, leftover copies of the clean app).
test('the home directory, the directory that holds the benchmark and the temporary directory are closed to Read, Edit and Bash', () => {
  const s = settingsFor('A', { benchRoot: '/home/user/bench', homeDir: '/root' });
  for (const root of ['/home/user', '/root', '/tmp']) {
    assert.ok(s.permissions.deny.includes(`Read(/${root}/**)`), root);
    assert.ok(s.permissions.deny.includes(`Edit(/${root}/**)`), root);
  }
  assert.deepEqual(s.sandbox.filesystem.denyRead, ['/home/user', '/root', '/tmp', '/var/tmp/avb-runs']);
  assert.deepEqual(s.sandbox.filesystem.allowRead, [RUN], 'the run root is closed but for the run\'s own directory');
});

test('a run directory inside a closed directory is refused', () => {
  assert.throws(() => settingsFor('A', { runRoot: '/tmp/runs', runDir: '/tmp/runs/avb-1' }), /run directory .* inside/);
  assert.throws(() => settingsFor('A', { runRoot: '/home/me/runs', runDir: '/home/me/runs/avb-1' }), /run directory .* inside/);
});

test('the directory hidden from the agent never names the benchmark', () => {
  assert.equal(hiddenRoot('/home/me/work/bench', '/home/me'), '/home/me', 'under the home directory: the whole home');
  assert.equal(hiddenRoot('/srv/studies/bench', '/root'), '/srv/studies', 'elsewhere: its parent');
  for (const rule of ['WebFetch', 'WebSearch', 'Read(//home/me/**)', 'Edit(//home/me/**)']) {
    assert.ok(settingsFor('B').permissions.deny.includes(rule), rule);
  }
  assert.ok(!JSON.stringify(settingsFor('B')).includes('bench'), 'the benchmark directory is not named anywhere in the settings');
});

test('the sandbox: on, fails rather than run unsandboxed, registry only, home unreadable except what a run needs', () => {
  const s = settingsFor('A', { readNeeds: ['/home/me/.cache/ms-playwright', '/opt/node22', '/home/me/.nvm/versions/node/v22'] });
  assert.equal(s.sandbox.enabled, true);
  assert.equal(s.sandbox.failIfUnavailable, true);
  assert.deepEqual(s.sandbox.network.allowedDomains, ['registry.npmjs.org']);
  assert.equal(s.sandbox.network.allowLocalBinding, true);
  assert.deepEqual(s.sandbox.filesystem.denyRead, ['/home/me', '/tmp', '/var/tmp/avb-runs']);
  assert.deepEqual(s.sandbox.filesystem.allowRead, [RUN, '/home/me/.cache/ms-playwright', '/home/me/.nvm/versions/node/v22'], 'the run, and needs inside a closed directory');
  const ca = settingsFor('A', { homeDir: '/root', readNeeds: ['/root/.ccr/ca-bundle.crt'] });
  assert.ok(ca.sandbox.filesystem.allowRead.includes('/root/.ccr/ca-bundle.crt'), 'a CA bundle in the home directory stays readable');
  assert.equal(settingsFor('A', { isolation: 'none' }).sandbox, undefined);
});

test('the built-in plugins of this Claude Code build are switched off', () => {
  assert.deepEqual(Object.keys(BUILTIN_PLUGINS).sort(), ['cc-plugin-agents-md@builtin', 'cc-plugin-plugin-authoring@builtin', 'cc-plugin-privacy@builtin']);
  assert.deepEqual(settingsFor('A').enabledPlugins, BUILTIN_PLUGINS);
  assert.ok(Object.values(BUILTIN_PLUGINS).every((v) => v === false));
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

const args = (agent, over = {}) => buildClaudeArgs({ agent, prompt: 'The pricing page looks off.', settingsFile: '/r/settings.json', instructionsFile: '/w/CLAUDE.md', mcpConfigFile: null, ...over });
const pair = (list, flag) => list[list.indexOf(flag) + 1];

test('the command line: print mode, prompt first, pinned model, locked tools, no settings, skills or plugins of the machine', () => {
  const a = args(subscription);
  assert.deepEqual(a.slice(0, 2), ['-p', 'The pricing page looks off.']);
  assert.ok(!a.includes('--bare'), '--bare refuses a subscription login: the same locked-down normal mode for every model');
  assert.equal(pair(a, '--output-format'), 'stream-json');
  assert.ok(a.includes('--verbose'));
  assert.equal(pair(a, '--model'), 'claude-sonnet-5-5');
  assert.equal(pair(a, '--tools'), 'Bash,Edit,Read');
  assert.equal(pair(a, '--setting-sources'), 'project');
  assert.ok(a.includes('--disable-slash-commands'));
  assert.equal(pair(a, '--permission-mode'), 'dontAsk');
  assert.equal(pair(a, '--permission-prompts'), 'none');
  assert.equal(pair(a, '--settings'), '/r/settings.json');
  assert.equal(pair(a, '--append-system-prompt-file'), '/w/CLAUDE.md');
  assert.ok(a.includes('--strict-mcp-config'));
  assert.equal(pair(a, '--max-turns'), '60');
  assert.equal(pair(a, '--max-budget-usd'), '10');
  assert.ok(a.includes('--no-session-persistence'));
  assert.ok(!a.includes('--mcp-config'));
  assert.ok(!a.includes('--effort'));
  assert.ok(!a.includes('--fallback-model'));
});

test('C adds its MCP config; an effort level is passed only when set', () => {
  const c = args({ ...subscription, effort: 'high' }, { mcpConfigFile: '/r/mcp.json' });
  assert.equal(pair(c, '--mcp-config'), '/r/mcp.json');
  assert.equal(pair(c, '--effort'), 'high');
});

test('a model priced by another provider gets no Claude Code spend cap: Claude Code prices its tokens wrongly', () => {
  assert.ok(!args(deepseek).includes('--max-budget-usd'));
  assert.equal(pair(args(deepseek), '--model'), 'deepseek-flash');
});

const BASE = {
  PATH: '/usr/bin', LANG: 'en_US.UTF-8', HOME: '/home/me',
  ANTHROPIC_API_KEY: 'sk-ant-api03-xxxxxxxxxxxx', ANTHROPIC_AUTH_TOKEN: 'tok', ANTHROPIC_BASE_URL: 'https://api.anthropic.com', CLAUDE_CODE_OAUTH_TOKEN: 'oauth',
  DEEPSEEK_API_KEY: 'ds-key-0000000000', CLAUDE_CODE_SESSION_ID: 'abc', CLAUDE_CODE_CHILD_SESSION: '1', CLAUDE_CODE_MESSAGING_TOKEN: 'm',
  GITHUB_TOKEN: 'ghp', AWS_SECRET_ACCESS_KEY: 'x', HTTPS_PROXY: 'http://proxy:1', NO_PROXY: 'localhost', NODE_EXTRA_CA_CERTS: '/ca.pem', PORT: '9999', CI: '1',
};
const envFor = (agent, extraEnv) => buildAgentEnv({ baseEnv: BASE, runDir: '/r', port: 41234, browsersPath: '/pw', agent, extraEnv });
const NEVER = ['ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_MESSAGING_TOKEN', 'GITHUB_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'CI', 'DEEPSEEK_API_KEY'];

test('every run gets a fresh home and config folder, its port, the browsers, and switches for a quiet, memory-less Claude Code', () => {
  const env = envFor(subscription);
  assert.equal(env.HOME, '/r/home');
  assert.equal(env.CLAUDE_CONFIG_DIR, '/r/home/.claude');
  assert.equal(env.TMPDIR, '/r/tmp');
  assert.equal(env.PORT, '41234');
  assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, '/pw');
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, '1');
  assert.equal(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  assert.equal(env.CLAUDE_CODE_DISABLE_CLAUDE_MDS, '1', 'the instructions come once, from --append-system-prompt-file');
});

test('subscription: no key and no base URL reach the run, so the machine\'s own Claude login is used', () => {
  const env = envFor(subscription);
  for (const name of [...NEVER, 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL']) assert.equal(env[name], undefined, name);
});

test('API key: only ANTHROPIC_API_KEY', () => {
  const env = envFor(apiKey);
  assert.equal(env.ANTHROPIC_API_KEY, 'sk-ant-api03-xxxxxxxxxxxx');
  for (const name of NEVER) assert.equal(env[name], undefined, name);
});

test('another provider: its base URL, its key (or a placeholder for a proxy to replace), and that model for every role', () => {
  const env = envFor(deepseek);
  assert.equal(env.ANTHROPIC_BASE_URL, 'https://api.deepseek.com/anthropic');
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, 'ds-key-0000000000');
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  for (const name of ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']) {
    assert.equal(env[name], 'deepseek-flash', name);
  }
  assert.equal(env.HTTPS_PROXY, 'http://proxy:1');
  assert.equal(env.NODE_EXTRA_CA_CERTS, '/ca.pem');
  const proxied = buildAgentEnv({ baseEnv: { PATH: '/bin' }, runDir: '/r', port: 1, browsersPath: '/pw', agent: deepseek });
  assert.equal(proxied.ANTHROPIC_AUTH_TOKEN, 'proxy-injected', 'no key on this machine: the network proxy holds it');
});

test('extra variables (the fake agent\'s, in tests) are added last', () => {
  assert.equal(envFor(subscription, { FAKE_CLAUDE_MODE: 'crash' }).FAKE_CLAUDE_MODE, 'crash');
});

test('the CA bundles a run is given are files it must read', () => {
  assert.deepEqual(caFiles({ NODE_EXTRA_CA_CERTS: '/root/.ccr/ca.crt', SSL_CERT_FILE: '/root/.ccr/ca.crt', HOME: '/root' }), ['/root/.ccr/ca.crt']);
  assert.deepEqual(caFiles({ SSL_CERT_FILE: '/etc/ssl/a.pem', NODE_EXTRA_CA_CERTS: '/opt/b.pem' }), ['/opt/b.pem', '/etc/ssl/a.pem']);
  assert.deepEqual(caFiles({}), []);
});
