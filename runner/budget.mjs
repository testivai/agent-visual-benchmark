// Whether a phase may start: a budget set by the maintainer, a dry run on the
// current settings, and the estimate within the budget (or confirmed).
import fs from 'node:fs';

export function readBudget(file) {
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/^budget_usd:\s*([0-9]+(?:\.[0-9]+)?)\s*$/m);
  return m ? Number(m[1]) : null;
}

export function latestDryRun(records, configHash) {
  return [...records].reverse().find((r) => r.config_hash === configHash && !r.error) ?? null;
}

const usd = (n) => `$${n.toFixed(2)}`;

export function gate({ plannedRuns, dryRun, budgetUsd, confirm }) {
  const lines = [`planned: ${plannedRuns} runs`];
  if (!dryRun) {
    return { ok: false, lines: [...lines, 'no dry run on the current settings: run `npm run runner -- dry-run` first'] };
  }
  const estimateUsd = dryRun.cost_usd * plannedRuns;
  const hours = (dryRun.seconds * plannedRuns) / 3600;
  lines.push(`one dry run cost ${usd(dryRun.cost_usd)} and took ${Math.round(dryRun.seconds)} s`);
  lines.push(`estimate for ${plannedRuns} runs: ${usd(estimateUsd)}, about ${hours.toFixed(1)} hours one at a time (a single run is a rough guide)`);
  if (budgetUsd === null) {
    return { ok: false, estimateUsd, lines: [...lines, 'no budget: set budget_usd in BUDGET.md'] };
  }
  lines.push(`budget: ${usd(budgetUsd)}`);
  if (estimateUsd > budgetUsd && !confirm) {
    return { ok: false, estimateUsd, lines: [...lines, 'the estimate is over the budget: re-run with --confirm to go ahead anyway'] };
  }
  return { ok: true, estimateUsd, lines };
}
