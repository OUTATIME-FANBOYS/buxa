import { describe, expect, it } from 'vitest';
import type { CheckInsByDay } from '../../camp/campHomeTypes';
import { periodChange } from '../homeCards';

/** A series of consecutive days, oldest first, with one count per day. */
const series = (counts: number[], complete = true): CheckInsByDay => ({
  days: counts.map((count, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, count, minors: null })),
  complete,
});

describe('periodChange', () => {
  it('compares the last range with the range before it, as a percentage', () => {
    // Previous 2 days: 4 + 4 = 8. Last 2 days: 6 + 6 = 12. Up 50%.
    expect(periodChange(series([4, 4, 6, 6]), 2)).toEqual({ text: '+50% vs previous 2 days', tone: 'ok' });
  });

  it('is a warning when the last range is down on the one before', () => {
    expect(periodChange(series([10, 10, 5, 5]), 2)).toEqual({ text: '-50% vs previous 2 days', tone: 'warn' });
  });

  it('says the same when the two ranges match, and is neutral', () => {
    expect(periodChange(series([3, 3, 3, 3]), 2)).toEqual({ text: 'Same vs previous 2 days', tone: 'neutral' });
  });

  it('is a plain count when the earlier period was empty', () => {
    expect(periodChange(series([0, 0, 2, 3]), 2)).toEqual({ text: '+5 vs previous 2 days', tone: 'ok' });
  });

  it('says the same when both periods are empty', () => {
    expect(periodChange(series([0, 0, 0, 0]), 2)).toEqual({ text: 'Same vs previous 2 days', tone: 'neutral' });
  });

  it('is null when there is no earlier period in the series, or the read was cut off', () => {
    expect(periodChange(series([1, 2, 3]), 2)).toBeNull();
    expect(periodChange(series([4, 4, 6, 6], false), 2)).toBeNull();
    expect(periodChange(null, 2)).toBeNull();
  });
});
