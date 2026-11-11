// What a run's outcome is. Pure.
import { readStatus } from './transcript.mjs';

const LIMITS = { error_max_turns: 'max_turns', error_max_budget_usd: 'max_budget' };

function mcpProblem(parsed, arm) {
  const servers = parsed.mcpServers ?? [];
  if (arm !== 'C') return servers.length > 0 ? `arm ${arm} must have no MCP server, found ${servers.map((s) => s.name).join(', ')}` : null;
  const testivai = servers.find((s) => s.name === 'testivai');
  return testivai?.status === 'connected' ? null : `the testivai MCP server did not connect (${testivai?.status ?? 'not listed'})`;
}

const agentError = (message) => ({ stopReason: 'error', error: { stage: 'agent', message } });

// A limit ends a run normally: it is scored as it stands. A crash, an API
// error, the wrong model or a missing tool is the harness's or the service's
// fault, not the agent's: an error, retried once, never counted as a failure.
export function classifyAgentRun({ parsed, agentRes, config, arm }) {
  if (agentRes.timedOut) return { stopReason: 'time_limit', error: null };
  if (!parsed.hasResult) {
    return agentError(`the agent ended without a result (exit ${agentRes.exitCode}${agentRes.signal ? `, ${agentRes.signal}` : ''}): ${agentRes.stderrTail.slice(-500)}`);
  }
  if (LIMITS[parsed.subtype]) return { stopReason: LIMITS[parsed.subtype], error: null };
  if (parsed.subtype !== 'success' || parsed.isError) {
    return agentError(`the agent ended with ${parsed.subtype}${parsed.isError ? ' (is_error)' : ''}: ${String(parsed.finalText).slice(0, 300)}`);
  }
  if (parsed.model && parsed.model !== config.agent.model) {
    return agentError(`the agent ran on model ${parsed.model}, not the pinned ${config.agent.model}`);
  }
  const mcp = mcpProblem(parsed, arm);
  if (mcp) return agentError(mcp);
  return { stopReason: 'completed', error: null };
}

const verdict = (status) => (status === 'passed' ? true : status === 'failed' ? false : null);

export function runOutcome({ score, collateral, tampered, status }) {
  const fixed = verdict(score);
  const collateralClean = verdict(collateral);
  const success = fixed === null || collateralClean === null ? null : fixed && collateralClean && !tampered;
  const claimed = status === 'done' ? true : status === 'not_done' ? false : null;
  return {
    fixed,
    collateral_clean: collateralClean,
    success,
    claimed_done: claimed,
    false_done: claimed === null || success === null ? null : claimed && !success,
  };
}

export { readStatus };
