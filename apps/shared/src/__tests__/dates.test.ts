import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, ago, diffDays, fmt, isoDay, pad, parse, toISO } from '../dates';

describe('dates', () => {
  it('pads and formats local calendar days', () => {
    expect(pad(7)).toBe('07');
    expect(toISO(new Date(2027, 6, 3))).toBe('2027-07-03');
    expect(parse('2027-07-03')).toEqual(new Date(2027, 6, 3));
  });
  it('adds days across month ends and measures whole days between two days', () => {
    expect(addDays('2027-07-30', 3)).toBe('2027-08-02');
    expect(addDays('2027-07-03', -3)).toBe('2027-06-30');
    expect(diffDays('2027-07-10', '2027-07-03')).toBe(7);
    expect(diffDays('2027-07-03', '2027-07-10')).toBe(-7);
  });
  it('isoDay is the local day of an instant', () => {
    expect(isoDay(new Date(2027, 6, 3, 12).toISOString())).toBe('2027-07-03');
  });
  it('fmt gives a short month and day, with the year on request', () => {
    expect(fmt('2027-07-03')).toBe(new Date(2027, 6, 3).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    expect(fmt('2027-07-03', true)).toContain('2027');
  });
  describe('ago', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2027, 6, 10, 12)); });
    afterEach(() => vi.useRealTimers());
    it('describes the age in the largest sensible unit', () => {
      const at = (ms: number) => new Date(Date.now() - ms).toISOString();
      expect(ago(at(5_000))).toBe('just now');
      expect(ago(at(5 * 60_000))).toBe('5m ago');
      expect(ago(at(3 * 3_600_000))).toBe('3h ago');
      expect(ago(at(2 * 86_400_000))).toBe('2d ago');
    });
    it('falls back to the date after a week', () => {
      const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
      expect(ago(old)).toBe(fmt(isoDay(old)));
    });
  });
});
