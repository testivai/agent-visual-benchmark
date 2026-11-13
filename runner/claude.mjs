// How one run starts Claude Code: its settings, its MCP servers, its command
// line and its environment. Pure: nothing is written or started here.
//
// Every model runs in Claude Code's normal mode, locked down. (--bare mode
// refuses a subscription login, and every model must run the same way.)
// What the lock gives, checked in docs/phase0-findings.md: exactly the tools
// Bash, Edit and Read (plus testivai's in arm C), no plugins, skills, hooks or
// user settings, the instructions given once, Bash in the sandbox.
import path from 'node:path';

export const BASE_TOOLS = ['Bash', 'Edit', 'Read'];

// Plugins built into Claude Code 2.1.322 that load even with an empty config.
// The startup check refuses a run if any plugin is still loaded.
export const BUILTIN_PLUGINS = {
  'cc-plugin-agents-md@builtin': false,
  'cc-plugin-privacy@builtin': false,
  'cc-plugin-plugin-authoring@builtin': false,
};

const inside = (p, root) => p === root || p.startsWith(root + path.sep);

// Claude Code tells the model which paths the sandbox blocks, so the blocked
// path must not name the benchmark: block the home directory that holds it,
// or its parent directory.
export function hiddenRoot(benchRoot, homeDir) {
  return inside(benchRoot, homeDir) && benchRoot !== homeDir ? homeDir : path.dirname(benchRoot);
}

// readNeeds: directories a run must read (the browsers, Node); those inside
// the hidden directory are let through.
export function buildSettings({ arm, benchRoot, homeDir, isolation, allowedNetwork, readNeeds = [] }) {
  const hidden = hiddenRoot(benchRoot, homeDir);
  const settings = {
    permissions: {
      allow: [...BASE_TOOLS, ...(arm === 'C' ? ['mcp__testivai'] : [])],
      deny: ['WebFetch', 'WebSearch', `Read(/${hidden}/**)`, `Edit(/${hidden}/**)`],
    },
    enabledPlugins: { ...BUILTIN_PLUGINS },
  };
  if (isolation === 'sandbox') {
    settings.sandbox = {
      enabled: true,
      failIfUnavailable: true,
      network: { allowedDomains: [...allowedNetwork], allowLocalBinding: true },
      filesystem: { denyRead: [hidden], allowRead: readNeeds.filter((p) => inside(p, hidden)) },
    };
  }
  return settings;
}

export function buildMcpConfig({ arm, workspace, nodePath }) {
  if (arm !== 'C') return null;
  return {
    mcpServers: {
      testivai: {
        type: 'stdio',
        command: nodePath,
        args: [path.join(workspace, 'node_modules', '@testivai', 'mcp', 'dist', 'server.js'), '--root', workspace],
      },
    },
  };
}

const PRICED_ELSEWHERE = 'anthropic-compatible';

// The prompt comes right after -p: later options take lists, and a list
// option would swallow a prompt placed after it.
export function buildClaudeArgs({ agent, prompt, settingsFile, instructionsFile, mcpConfigFile }) {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', agent.model,
    '--tools', BASE_TOOLS.join(','),
    '--setting-sources', 'project',
    '--disable-slash-commands',
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
    '--settings', settingsFile,
    '--append-system-prompt-file', instructionsFile,
    '--strict-mcp-config',
    '--max-turns', String(agent.maxTurns),
    '--no-session-persistence',
  ];
  // Claude Code prices every token at Anthropic's rates: its spend cap means
  // nothing for another provider's model, whose cost the runner computes.
  if (agent.provider !== PRICED_ELSEWHERE) args.push('--max-budget-usd', String(agent.maxBudgetUsdPerRun));
  if (agent.effort) args.push('--effort', agent.effort);
  if (mcpConfigFile) args.push('--mcp-config', mcpConfigFile);
  return args;
}

// Passed through from the runner's environment when set. Nothing else is:
// no session variables, no credentials but the one the provider needs.
const PASS_THROUGH = [
  'PATH', 'LANG', 'LC_ALL', 'TZ',
  'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy',
  'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE',
];

const MODEL_ROLES = ['ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL'];

// What reaches Claude Code for the model's login:
//   anthropic-subscription  nothing: the machine's own Claude login
//   anthropic-api-key       ANTHROPIC_API_KEY
//   anthropic-compatible    the provider's base URL and key (or a placeholder that a
//                           network proxy holding the key replaces), and that model in
//                           every role, so no request names a model the provider remaps
function providerEnv(agent, baseEnv) {
  if (agent.provider === 'anthropic-api-key') return baseEnv.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: baseEnv.ANTHROPIC_API_KEY } : {};
  if (agent.provider !== PRICED_ELSEWHERE) return {};
  return {
    ANTHROPIC_BASE_URL: agent.baseUrl,
    ANTHROPIC_AUTH_TOKEN: baseEnv[agent.authTokenEnv] || 'proxy-injected',
    ...Object.fromEntries(MODEL_ROLES.map((name) => [name, agent.model])),
  };
}

export function buildAgentEnv({ baseEnv, runDir, port, browsersPath, agent, extraEnv = {} }) {
  const env = {};
  for (const name of PASS_THROUGH) {
    if (baseEnv[name] !== undefined && baseEnv[name] !== '') env[name] = baseEnv[name];
  }
  Object.assign(env, providerEnv(agent, baseEnv), {
    HOME: path.join(runDir, 'home'),
    CLAUDE_CONFIG_DIR: path.join(runDir, 'home', '.claude'),
    TMPDIR: path.join(runDir, 'tmp'),
    TERM: 'dumb',
    PORT: String(port),
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1',
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1',
    DISABLE_TELEMETRY: '1',
  });
  return { ...env, ...extraEnv };
}
