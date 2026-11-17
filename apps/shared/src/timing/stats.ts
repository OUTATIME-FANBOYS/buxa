/** Summary statistics for a list of timings in milliseconds. Used by the check-in timing test and the browser timing script. */
export interface TimingSummary {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

/**
 * The nearest-rank percentile of `sorted` (ascending, non-empty). `p` is in (0, 100]. Nearest-rank always returns one of the
 * measured values, which is what a person reading "p95 = 812 ms" expects to be a real request.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error('Cannot take a percentile of no samples.');
  if (!(p > 0 && p <= 100)) throw new Error(`Percentile must be in (0, 100], got ${p}.`);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

/** p50, p95 and max of the samples. Throws on an empty list rather than reporting zeros. */
export function summarize(samples: readonly number[]): TimingSummary {
  if (samples.length === 0) throw new Error('Cannot summarise no samples.');
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

/** One line for the console, for example `scan: n=100  p50 41.2 ms  p95 88.0 ms  max 150.3 ms`. */
export function formatSummary(label: string, summary: TimingSummary): string {
  const ms = (value: number) => `${value.toFixed(1)} ms`;
  return `${label}: n=${summary.count}  p50 ${ms(summary.p50)}  p95 ${ms(summary.p95)}  max ${ms(summary.max)}`;
}
