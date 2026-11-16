import { describe, expect, it } from 'vitest';
import { localDayStart, localDaysWindow, nextLocalDay } from '../shared/campDay';

describe('camp-local day arithmetic', () => {
  it('starts a UTC day at midnight UTC', () => {
    expect(localDayStart('2027-07-11', 'UTC')).toBe('2027-07-11T00:00:00.000Z');
  });

  it('starts an Auckland winter day twelve hours before UTC midnight', () => {
    expect(localDayStart('2027-07-11', 'Pacific/Auckland')).toBe('2027-07-10T12:00:00.000Z');
  });

  it('starts a New York day after a spring-forward change at the right instant', () => {
    // Daylight saving began at 02:00 on 14 March 2027; midnight that morning was still EST (UTC-5).
    expect(localDayStart('2027-03-14', 'America/New_York')).toBe('2027-03-14T05:00:00.000Z');
    expect(localDayStart('2027-03-15', 'America/New_York')).toBe('2027-03-15T04:00:00.000Z');
  });

  it('steps to the next calendar day across month and year ends', () => {
    expect(nextLocalDay('2027-02-28')).toBe('2027-03-01');
    expect(nextLocalDay('2027-12-31')).toBe('2028-01-01');
  });

  it('gives a window covering the days inclusively, with an exclusive end', () => {
    expect(localDaysWindow('2027-07-10', '2027-07-11', 'UTC')).toEqual({ from: '2027-07-10T00:00:00.000Z', to: '2027-07-12T00:00:00.000Z' });
  });

  it('refuses something that is not a real day', () => {
    expect(() => localDayStart('2027-02-30', 'UTC')).toThrow();
  });
});
