// runner.config.json: the settings every run shares, and the models.
// A run uses one model: selectModel() merges that model's entry into `agent`.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ARMS } from './arms.mjs';

const EFFORTS = [null, 'low', 'medium', 'high', 'xhigh', 'max'];
const ISOLATION = ['sandbox', 'none'];
const PROVIDERS = ['anthropic-subscription', 'anthropic-api-key', 'anthropic-compatible'];
const PRICE_KEYS = ['input', 'cacheRead', 'cacheWrite', 'output'];

export function loadConfig(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const positive = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const positiveInt = (n) => Number.isInteger(n) && n > 0;

function agentProblems(agent = {}) {
  const problems = [];
  if (!Array.isArray(agent.command) || agent.command.length === 0) problems.push('agent.command must be a non-empty array, e.g. ["claude"]');
  if ('model' in agent) problems.push('agent.model is not used: each model is an entry under models');
  if (!EFFORTS.includes(agent.effort)) problems.push(`agent.effort must be one of ${EFFORTS.join(', ')}`);
  if (!positiveInt(agent.maxTurns)) problems.push('agent.maxTurns must be a positive whole number');
  if (!positive(agent.maxBudgetUsdPerRun)) problems.push('agent.maxBudgetUsdPerRun must be positive');
  if (!positive(agent.timeLimitMinutes)) problems.push('agent.timeLimitMinutes must be positive');
  return problems;
}

function priceProblems(id, prices) {
  if (!prices || typeof prices !== 'object') return [`models.${id}.pricesPerMillionUsd must give ${PRICE_KEYS.join(', ')}`];
  return PRICE_KEYS.filter((k) => !(typeof prices[k] === 'number' && prices[k] >= 0))
    .map((k) => `models.${id}.pricesPerMillionUsd.${k} must be a price of 0 or more`);
}

// Another provider's model: its endpoint, the variable that may hold its key,
// and its prices (Claude Code prices every token at Anthropic's rates).
function compatibleProblems(id, m) {
  const problems = [];
  if (typeof m.baseUrl !== 'string' || !m.baseUrl.startsWith('https://')) problems.push(`models.${id}.baseUrl must be an https URL`);
  if (typeof m.authTokenEnv !== 'string' || m.authTokenEnv === '') problems.push(`models.${id}.authTokenEnv must name the variable that may hold the key`);
  return [...problems, ...priceProblems(id, m.pricesPerMillionUsd)];
}

function modelProblems(id, m) {
  const problems = [];
  if (!/^[a-z0-9-]+$/.test(id)) problems.push(`model id "${id}" must be lower-case letters, digits and dashes`);
  if (typeof m.model !== 'string' || m.model.trim() === '') problems.push(`models.${id}.model must name the model`);
  if (!PROVIDERS.includes(m.provider)) problems.push(`models.${id}.provider must be one of ${PROVIDERS.join(', ')}`);
  if (m.provider === 'anthropic-compatible') problems.push(...compatibleProblems(id, m));
  return problems;
}

function modelsProblems(models) {
  const entries = Object.entries(models ?? {});
  if (entries.length === 0) return ['models must list at least one model'];
  const problems = entries.flatMap(([id, m]) => modelProblems(id, m));
  if (entries.filter(([, m]) => m.primary === true).length !== 1) problems.push('models must have exactly one primary model ("primary": true)');
  return problems;
}

export function validateConfig(config) {
  const problems = [...agentProblems(config.agent), ...modelsProblems(config.models)];
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

export function primaryModel(config) {
  return Object.entries(config.models).find(([, m]) => m.primary === true)?.[0] ?? null;
}

// The config one model's runs use: its entry merged into `agent`, the other
// models left out (so their settings cannot change this model's hash).
export function selectModel(config, id) {
  const entry = config.models?.[id];
  if (!entry) throw new Error(`unknown model "${id}": the config has ${Object.keys(config.models ?? {}).join(', ')}`);
  const { models, ...shared } = config;
  return { ...shared, model: id, agent: { ...config.agent, ...entry, id } };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Identifies the settings a model's runs depend on. How many runs go at once
// does not change a run, so it is left out.
export function configHash(selected) {
  const { concurrency, ...rest } = selected;
  return crypto.createHash('sha256').update(canonical(rest)).digest('hex').slice(0, 16);
}
