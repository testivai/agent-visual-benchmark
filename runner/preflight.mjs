// Checks that cost nothing, before any real run.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { browsersPath } from './templates.mjs';
import { validateConfig } from './config.mjs';

export function parseClaudeVersion(text) {
  return String(text).match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
}

function onPath(bin) {
  return spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0;
}

function versionProblems(config) {
  const [cmd, ...pre] = config.agent.command;
  const out = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
  const version = parseClaudeVersion(out.stdout ?? '');
  if (!version) return { version, problems: [`could not run ${config.agent.command.join(' ')} --version`] };
  if (config.agent.claudeCodeVersion && version !== config.agent.claudeCodeVersion) {
    return { version, problems: [`Claude Code is ${version}, the config pins ${config.agent.claudeCodeVersion}`] };
  }
  return { version, problems: [] };
}

function machineProblems(config, env) {
  const problems = [];
  if (!env.ANTHROPIC_API_KEY) problems.push('ANTHROPIC_API_KEY is not set (runs use an API key, never a logged-in subscription)');
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

export function preflight(config, env = process.env) {
  const configProblems = validateConfig(config);
  if (configProblems.length > 0) return { version: null, problems: configProblems };
  const { version, problems } = versionProblems(config);
  return { version, problems: [...problems, ...machineProblems(config, env)] };
}
