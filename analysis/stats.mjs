// Small statistics, written out so a reader can check them.
import { mulberry32 } from '../runner/rng.mjs';

const Z95 = 1.959964;

// Wilson score interval for k successes in n trials.
export function wilson(k, n, z = Z95) {
  if (n === 0) return { rate: null, low: null, high: null };
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { rate: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

function percentile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// Percentile bootstrap of the mean, with the two-sided interval and the
// lower bound of the one-sided interval at the same level. The unit resampled is whatever `values`
// holds: here, one value per task, because repeats of one task are not
// independent of each other.
export function bootstrapMean(values, { resamples = 10000, seed = 1, level = 0.95 } = {}) {
  if (values.length === 0) return { mean: null, low: null, high: null, lowerOneSided: null, n: 0 };
  const random = mulberry32(seed);
  const means = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)];
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  const tail = (1 - level) / 2;
  return {
    mean: mean(values),
    low: percentile(means, tail),
    high: percentile(means, 1 - tail),
    // the one-sided interval at the same level: everything above this bound
    lowerOneSided: percentile(means, 1 - level),
    n: values.length,
  };
}

// The last attempt of each run, in the order runs first appear.
export function finalRecords(records) {
  const last = new Map();
  for (const r of records) last.set(r.run_id, r);
  return [...last.values()];
}
