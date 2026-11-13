// Whether a phase may start: a budget for the model set by the maintainer, a
// dry run on the current settings, and the estimate within the budget (or
// confirmed). A model on a subscription has no dollar budget.
import fs from 'node:fs';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `budget_usd.<model>: <dollars>` or `budget_usd.<model>: subscription`.
export function readBudget(file, modelId) {
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(new RegExp(`^budget_usd\\.${escape(modelId)}:\\s*(\\S+)\\s*$`, 'm'));
  if (!m) return null;
  if (m[1] === 'subscription') return 'subscription';
  return /^[0-9]+(?:\.[0-9]+)?$/.test(m[1]) ? Number(m[1]) : null;
}

export function latestDryRun(records, configHash) {
  return [...records].reverse().find((r) => r.config_hash === configHash && !r.error) ?? null;
}

const usd = (n) => `$${n.toFixed(2)}`;

function estimateLines(dryRun, plannedRuns, label) {
  const estimateUsd = dryRun.cost_usd * plannedRuns;
  const hours = (dryRun.seconds * plannedRuns) / 3600;
  return {
    estimateUsd,
    lines: [
      `one dry run: ${usd(dryRun.cost_usd)} (${label}), ${Math.round(dryRun.seconds)} s`,
      `estimate for ${plannedRuns} runs: ${usd(estimateUsd)} ${label}, about ${hours.toFixed(1)} hours one at a time (a single run is a rough guide)`,
    ],
  };
}

export function gate({ plannedRuns, dryRun, budget, confirm }) {
  const lines = [`planned: ${plannedRuns} runs`];
  if (!dryRun) {
    return { ok: false, lines: [...lines, 'no dry run on the current settings: run `npm run runner -- dry-run` first'] };
  }
  if (budget === 'subscription') {
    const e = estimateLines(dryRun, plannedRuns, 'API-equivalent');
    return { ok: true, estimateUsd: e.estimateUsd, lines: [...lines, ...e.lines, 'subscription: no dollar budget; usage counts against the plan\'s limits, and runs pause when a limit is hit'] };
  }
  const e = estimateLines(dryRun, plannedRuns, 'at the model\'s prices');
  lines.push(...e.lines);
  if (budget === null) {
    return { ok: false, estimateUsd: e.estimateUsd, lines: [...lines, 'no budget for this model: set budget_usd.<model> in BUDGET.md'] };
  }
  lines.push(`budget: ${usd(budget)}`);
  if (e.estimateUsd > budget && !confirm) {
    return { ok: false, estimateUsd: e.estimateUsd, lines: [...lines, 'the estimate is over the budget: re-run with --confirm to go ahead anyway'] };
  }
  return { ok: true, estimateUsd: e.estimateUsd, lines };
}
