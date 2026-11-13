// Checks that cost nothing, before any real run.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browsersPath } from './templates.mjs';

export function parseClaudeVersion(text) {
  return String(text).match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
}

export function parseAuthStatus(text) {
  try {
    const o = JSON.parse(text);
    return { loggedIn: o.loggedIn === true, authMethod: o.authMethod ?? null };
  } catch {
    return { loggedIn: false, authMethod: null };
  }
}

// A subscription model uses the machine's Claude login; an API-key model the
// key; another provider its key, or a network proxy that holds it.
export function loginProblems(agent, env, auth) {
  if (agent.provider === 'anthropic-subscription' && !auth.loggedIn) {
    return [`model ${agent.id} uses the Claude login, and Claude Code is not logged in on this machine`];
  }
  if (agent.provider === 'anthropic-api-key' && !env.ANTHROPIC_API_KEY) {
    return [`model ${agent.id} needs ANTHROPIC_API_KEY`];
  }
  return [];
}

function onPath(bin) {
  return spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0;
}

function claude(config, args) {
  const [cmd, ...pre] = config.agent.command;
  return spawnSync(cmd, [...pre, ...args], { encoding: 'utf8', timeout: 30000 }).stdout ?? '';
}

function versionProblems(config) {
  const version = parseClaudeVersion(claude(config, ['--version']));
  if (!version) return { version, problems: [`could not run ${config.agent.command.join(' ')} --version`] };
  if (config.agent.claudeCodeVersion && version !== config.agent.claudeCodeVersion) {
    return { version, problems: [`Claude Code is ${version}, the config pins ${config.agent.claudeCodeVersion}`] };
  }
  return { version, problems: [] };
}

function machineProblems(config, env) {
  const problems = [];
  const browsers = browsersPath(env);
  if (!fs.existsSync(browsers) || !fs.readdirSync(browsers).some((d) => d.startsWith('chromium'))) {
    problems.push(`no Chromium under ${browsers}: run npx playwright install chromium`);
  }
  if (config.isolation === 'sandbox' && process.platform === 'linux') {
    for (const bin of ['bwrap', 'socat']) {
      if (!onPath(bin)) problems.push(`the sandbox needs ${bin} on Linux: sudo apt-get install bubblewrap socat`);
    }
  }
  return problems;
}

// `config` is a selected config (selectModel): it names one model.
export function preflight(config, env = process.env) {
  const { version, problems } = versionProblems(config);
  const auth = config.agent.provider === 'anthropic-subscription' ? parseAuthStatus(claude(config, ['auth', 'status'])) : { loggedIn: false, authMethod: null };
  return { version, problems: [...problems, ...loginProblems(config.agent, env, auth), ...machineProblems(config, env)] };
}
