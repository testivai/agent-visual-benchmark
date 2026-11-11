// runner.config.json: the settings every run of a phase shares.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ARMS } from './arms.mjs';

const EFFORTS = [null, 'low', 'medium', 'high', 'xhigh', 'max'];
const ISOLATION = ['sandbox', 'none'];

export function loadConfig(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const positive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const positiveInt = (n) => Number.isInteger(n) && n > 0;

function agentProblems(agent = {}) {
  const problems = [];
  if (!Array.isArray(agent.command) || agent.command.length === 0) problems.push('agent.command must be a non-empty array, e.g. ["claude"]');
  if (typeof agent.model !== 'string' || agent.model.trim() === '') problems.push('agent.model must name the model');
  if (!EFFORTS.includes(agent.effort)) problems.push(`agent.effort must be one of ${EFFORTS.join(', ')}`);
  if (!positiveInt(agent.maxTurns)) problems.push('agent.maxTurns must be a positive whole number');
  if (!positive(agent.maxBudgetUsdPerRun)) problems.push('agent.maxBudgetUsdPerRun must be positive');
  if (!positive(agent.timeLimitMinutes)) problems.push('agent.timeLimitMinutes must be positive');
  return problems;
}

export function validateConfig(config) {
  const problems = agentProblems(config.agent);
  const arms = config.arms ?? [];
  if (arms.length === 0 || arms.some((a) => !(a in ARMS))) problems.push(`arms must be a list from ${Object.keys(ARMS).join(', ')}`);
  if (!ISOLATION.includes(config.isolation)) problems.push(`isolation must be one of ${ISOLATION.join(', ')}`);
  if (!Array.isArray(config.allowedNetwork)) problems.push('allowedNetwork must be a list of host names');
  for (const phase of ['pilot', 'full']) {
    if (!positiveInt(config.repeats?.[phase])) problems.push(`repeats.${phase} must be a positive whole number`);
  }
  for (const seed of ['pilotTasks', 'order']) {
    if (!Number.isInteger(config.seeds?.[seed])) problems.push(`seeds.${seed} must be a whole number`);
  }
  if (!positiveInt(config.concurrency)) problems.push('concurrency must be a positive whole number');
  return problems;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Identifies the settings a run depends on. How many runs go at once does not
// change a run, so it is left out.
export function configHash(config) {
  const { concurrency, ...rest } = config;
  return crypto.createHash('sha256').update(canonical(rest)).digest('hex').slice(0, 16);
}
