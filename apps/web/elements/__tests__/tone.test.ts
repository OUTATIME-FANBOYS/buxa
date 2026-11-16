import { describe, expect, it } from 'vitest';
import type { ChartTone } from '../chartTone';

describe('ChartTone', () => {
  it('lists the chart tones the palette defines', () => {
    const tones: ChartTone[] = ['brand', 'ok', 'warn', 'crit', 'agent', 'neutral'];
    expect(new Set(tones).size).toBe(6);
  });
});
