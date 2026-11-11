// How one run starts Claude Code: its settings, its MCP servers, its command
// line and its environment. Pure: nothing is written or started here.
import path from 'node:path';

// --bare mode gives the agent exactly these three built-in tools, whatever
// --tools asks for (checked with Claude Code 2.1.322). Bash covers the rest.
const ALLOWED_TOOLS = ['Bash', 'Edit', 'Read'];

export function buildSettings({ arm, benchRoot, isolation, allowedNetwork }) {
  const settings = {
    permissions: {
      allow: [...ALLOWED_TOOLS, ...(arm === 'C' ? ['mcp__testivai'] : [])],
      deny: ['WebFetch', 'WebSearch', `Read(/${benchRoot}/**)`, `Edit(/${benchRoot}/**)`],
    },
  };
  if (isolation === 'sandbox') {
    settings.sandbox = {
      enabled: true,
      failIfUnavailable: true,
      network: { allowedDomains: [...allowedNetwork], allowLocalBinding: true },
      filesystem: { denyRead: [benchRoot] },
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

// The prompt comes right after -p: later options take lists, and a list
// option would swallow a prompt placed after it.
export function buildClaudeArgs({ agent, prompt, settingsFile, instructionsFile, mcpConfigFile }) {
  const args = [
    '--bare', '-p', prompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', agent.model,
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
    '--settings', settingsFile,
    '--append-system-prompt-file', instructionsFile,
    '--strict-mcp-config',
    '--max-turns', String(agent.maxTurns),
    '--max-budget-usd', String(agent.maxBudgetUsdPerRun),
    '--no-session-persistence',
  ];
  if (agent.effort) args.push('--effort', agent.effort);
  if (mcpConfigFile) args.push('--mcp-config', mcpConfigFile);
  return args;
}

// Passed through from the runner's environment when set. Nothing else is:
// no session variables, no other credentials.
const PASS_THROUGH = [
  'PATH', 'LANG', 'LC_ALL', 'TZ',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL',
  'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy',
  'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE',
];

export function buildAgentEnv({ baseEnv, runDir, port, browsersPath, extraEnv = {} }) {
  const env = {};
  for (const name of PASS_THROUGH) {
    if (baseEnv[name] !== undefined && baseEnv[name] !== '') env[name] = baseEnv[name];
  }
  Object.assign(env, {
    HOME: path.join(runDir, 'home'),
    CLAUDE_CONFIG_DIR: path.join(runDir, 'home', '.claude'),
    TMPDIR: path.join(runDir, 'tmp'),
    TERM: 'dumb',
    PORT: String(port),
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: '1',
    DISABLE_TELEMETRY: '1',
  });
  return { ...env, ...extraEnv };
}
