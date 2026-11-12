// What a run's outcome is. Pure.
import { readStatus } from './transcript.mjs';
import { startupProblems } from './startup.mjs';

const LIMITS = { error_max_turns: 'max_turns', error_max_budget_usd: 'max_budget' };

const agentError = (message, stage = 'agent') => ({ stopReason: 'error', error: { stage, message } });

// The startup report as saved in the transcript, checked again after the run.
function savedStartupProblems(parsed, { arm, model }) {
  if (!parsed.model) return ['the transcript has no startup report'];
  return startupProblems({ model: parsed.model, tools: parsed.tools, plugins: parsed.plugins, skills: parsed.skills, mcp_servers: parsed.mcpServers }, { arm, model });
}

// A limit ends a run normally: it is scored as it stands. A crash, an API
// error, the wrong model or a missing tool is the harness's or the service's
// fault, not the agent's: an error, retried once, never counted as a failure.
export function classifyAgentRun({ parsed, agentRes, config, arm }) {
  if (agentRes.stoppedAtStartup) return agentError(`stopped at startup: ${agentRes.stoppedAtStartup.join('; ')}`, 'startup');
  if (agentRes.timedOut) return { stopReason: 'time_limit', error: null };
  if (!parsed.hasResult) {
    return agentError(`the agent ended without a result (exit ${agentRes.exitCode}${agentRes.signal ? `, ${agentRes.signal}` : ''}): ${agentRes.stderrTail.slice(-500)}`);
  }
  if (LIMITS[parsed.subtype]) return { stopReason: LIMITS[parsed.subtype], error: null };
  if (parsed.subtype !== 'success' || parsed.isError) {
    return agentError(`the agent ended with ${parsed.subtype}${parsed.isError ? ' (is_error)' : ''}: ${String(parsed.finalText).slice(0, 300)}`);
  }
  const startup = savedStartupProblems(parsed, { arm, model: config.agent.model });
  if (startup.length > 0) return agentError(`the run was not isolated as planned: ${startup.join('; ')}`, 'startup');
  return { stopReason: 'completed', error: null };
}

const verdict = (status) => (status === 'passed' ? true : status === 'failed' ? false : null);

// The title of the one test in each fix task's score.spec.ts that checks the
// values the seed changed are back as they were. Every other test in it checks
// the symptom (a test keeps this title and the specs in step).
export const RESTORE_TEST = 'everything the seed changed is back as it was';

// The symptom is gone: the score passed, or the restore test was its only failure.
function symptomVerdict(score, failedTests) {
  if (score !== 'failed') return verdict(score);
  if (!Array.isArray(failedTests) || failedTests.length === 0) return null;
  return failedTests.every((title) => title === RESTORE_TEST);
}

const allOf = (a, b, tampered) => (a === null || b === null ? null : a && b && !tampered);

// scoreFailedTests: the titles of the score spec's failed tests.
export function runOutcome({ score, collateral, tampered, status, scoreFailedTests }) {
  const fixed = verdict(score);
  const collateralClean = verdict(collateral);
  const success = allOf(fixed, collateralClean, tampered);
  const symptomFixed = symptomVerdict(score, scoreFailedTests);
  const claimed = status === 'done' ? true : status === 'not_done' ? false : null;
  return {
    fixed,
    collateral_clean: collateralClean,
    success,
    symptom_fixed: symptomFixed,
    lenient_success: allOf(symptomFixed, collateralClean, tampered),
    claimed_done: claimed,
    false_done: claimed === null || success === null ? null : claimed && !success,
  };
}

export { readStatus };
