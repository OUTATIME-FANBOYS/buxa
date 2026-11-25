import { describe, expect, it } from 'vitest';
import { seriesDaysLabel } from '../seriesDays';

describe('seriesDaysLabel: the days of a series in the Classes table', () => {
  it('reads a run of consecutive days as its first and last day', () => {
    expect(seriesDaysLabel([1, 2, 3, 4, 5])).toBe('Mon to Fri');
    expect(seriesDaysLabel([6, 7])).toBe('Sat to Sun');
  });

  it('lists days that are not consecutive, in week order', () => {
    expect(seriesDaysLabel([3, 1])).toBe('Mon, Wed');
    expect(seriesDaysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('reads one day as that day, and no days as No days', () => {
    expect(seriesDaysLabel([2])).toBe('Tue');
    expect(seriesDaysLabel([])).toBe('No days');
  });
});
