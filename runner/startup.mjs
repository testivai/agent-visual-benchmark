// What Claude Code's startup report must say for a run to go on. Anything
// else, and the runner stops the run (runner/agent.mjs) and records an error.
import { BASE_TOOLS } from './claude.mjs';

const isTestivai = (tool) => tool.startsWith('mcp__testivai__');

function toolProblems(tools = [], arm) {
  const problems = [];
  const missing = BASE_TOOLS.filter((t) => !tools.includes(t));
  if (missing.length) problems.push(`missing tools: ${missing.join(', ')}`);
  const extra = tools.filter((t) => !BASE_TOOLS.includes(t) && !(arm === 'C' && isTestivai(t)));
  if (extra.length) problems.push(`tools that must not be there: ${extra.join(', ')}`);
  if (arm === 'C' && !tools.some(isTestivai)) problems.push('arm C has no testivai tools');
  return problems;
}

function serverProblems(servers = [], arm) {
  const names = servers.map((s) => s.name);
  if (arm !== 'C') return names.length ? [`arm ${arm} must have no MCP server, found ${names.join(', ')}`] : [];
  const problems = [];
  const testivai = servers.find((s) => s.name === 'testivai');
  if (testivai?.status !== 'connected') problems.push(`the testivai MCP server is ${testivai?.status ?? 'not there'}`);
  const others = names.filter((n) => n !== 'testivai');
  if (others.length) problems.push(`MCP servers that must not be there: ${others.join(', ')}`);
  return problems;
}

const names = (list) => (list ?? []).map((x) => (typeof x === 'string' ? x : x.name));

export function startupProblems(init, { arm, model }) {
  const problems = [];
  if (init.model !== model) problems.push(`model ${init.model}, not the pinned ${model}`);
  problems.push(...toolProblems(init.tools, arm), ...serverProblems(init.mcp_servers, arm));
  if (names(init.plugins).length) problems.push(`plugins loaded: ${names(init.plugins).join(', ')}`);
  if (names(init.skills).length) problems.push(`skills loaded: ${names(init.skills).join(', ')}`);
  return problems;
}
