// When a run is cut off by a usage or rate limit (a subscription's limit, an
// overloaded service), the runner waits and runs it again: the agent did not
// fail, and the run's one retry is kept for real errors.
// Also: what a run costs at a provider's own prices.

const LIMIT_TEXT = [
  /usage limit reached/i,
  /hit your (session |weekly |daily |monthly )?limit/i,
  /rate[_ ]limit/i,
  /\b429\b/,
  /\b529\b/,
  /overloaded/i,
];

const MINUTE = 60 * 1000;
const MAX_WAIT = 12 * 60 * MINUTE;

// Only a run that ended in an error (or without a result) can have hit a limit:
// a successful run that mentions one did not.
export function usageLimit(parsed, agentRes) {
  const ended = !parsed.hasResult || parsed.isError;
  if (!ended) return null;
  const text = `${parsed.finalText ?? ''}\n${agentRes.stderrTail ?? ''}`;
  const hit = LIMIT_TEXT.find((re) => re.test(text));
  if (!hit) return null;
  const epoch = text.match(/limit reached\|(\d{9,11})/i)?.[1];
  return {
    resetAt: epoch ? new Date(Number(epoch) * 1000).toISOString() : null,
    message: text.trim().split('\n').find((line) => hit.test(line))?.slice(0, 300) ?? '',
  };
}

// How long to wait before trying again; `waits` is how many times this run has waited already.
export function waitFor(limit, waits, now = Date.now()) {
  if (limit.resetAt) return Math.min(MAX_WAIT, Math.max(MINUTE, Date.parse(limit.resetAt) - now + MINUTE));
  return Math.min(2 * 60 * MINUTE, 15 * MINUTE * 2 ** waits);
}

// tokens { input, output, cacheRead, cacheWrite }; prices in USD per million tokens.
export function runCost(tokens, prices) {
  if (!tokens) return null;
  return (tokens.input * prices.input + tokens.output * prices.output + tokens.cacheRead * prices.cacheRead + tokens.cacheWrite * prices.cacheWrite) / 1e6;
}
