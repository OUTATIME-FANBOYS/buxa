import { describe, expect, it } from 'vitest';
import { progressValue } from '@/components/elements';

describe('progressValue', () => {
  it('clamps to 0-100 and rounds', () => {
    expect(progressValue(-5)).toBe(0);
    expect(progressValue(140)).toBe(100);
    expect(progressValue(33.6)).toBe(34);
  });
});
