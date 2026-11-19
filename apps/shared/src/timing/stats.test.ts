import { describe, expect, it } from 'vitest';
import { formatSummary, percentile, summarize } from './stats';

describe('percentile (nearest rank)', () => {
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns a measured value, using the rank ceil(p/100 * n)', () => {
    expect(percentile(ten, 50)).toBe(5);
    expect(percentile(ten, 95)).toBe(10);
    expect(percentile(ten, 10)).toBe(1);
    expect(percentile(ten, 100)).toBe(10);
  });

  it('a single sample is every percentile', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it('p95 of 100 samples is the 95th smallest', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(hundred, 95)).toBe(95);
    expect(percentile(hundred, 50)).toBe(50);
  });

  it('refuses no samples and an out-of-range percentile', () => {
    expect(() => percentile([], 50)).toThrow(/no samples/);
    expect(() => percentile([1], 0)).toThrow(/must be in/);
    expect(() => percentile([1], 101)).toThrow(/must be in/);
  });
});

describe('summarize', () => {
  it('sorts unsorted input and reports count, p50, p95 and max', () => {
    expect(summarize([30, 10, 20])).toEqual({ count: 3, p50: 20, p95: 30, max: 30 });
  });

  it('does not change the array it was given', () => {
    const samples = [3, 1, 2];
    summarize(samples);
    expect(samples).toEqual([3, 1, 2]);
  });

  it('refuses an empty list instead of reporting zeros', () => {
    expect(() => summarize([])).toThrow(/no samples/);
  });
});

describe('formatSummary', () => {
  it('prints one line with the label and the three numbers to one decimal place', () => {
    expect(formatSummary('scan', { count: 100, p50: 41.25, p95: 88, max: 150.333 })).toBe(
      'scan: n=100  p50 41.3 ms  p95 88.0 ms  max 150.3 ms',
    );
  });
});
