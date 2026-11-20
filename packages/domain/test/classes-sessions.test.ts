import { describe, expect, it } from 'vitest';
import { classWithinSession, isClassAge, isValidCampSize, MAX_CAMP_SIZE, MIN_CAMP_SIZE } from '../src';

describe('camp size', () => {
  it('accepts whole numbers from 3 to 30 only', () => {
    expect(MIN_CAMP_SIZE).toBe(3);
    expect(MAX_CAMP_SIZE).toBe(30);
    expect([2, 2.5, 31, 0, -1, Number.NaN].map(isValidCampSize)).toEqual([false, false, false, false, false, false]);
    expect([3, 12, 30].map(isValidCampSize)).toEqual([true, true, true]);
  });
});

describe('class ages', () => {
  it('accepts whole ages from 3 to 20 only', () => {
    expect([2, 2.5, 21, 0, 120, Number.NaN].map(isClassAge)).toEqual([false, false, false, false, false, false]);
    expect([3, 8, 20].map(isClassAge)).toEqual([true, true, true]);
  });
});

describe('classWithinSession', () => {
  const session = { startsOn: '2027-07-05', endsOn: '2027-07-18' };
  const zone = 'Europe/London';

  it('accepts a class on the first and last day of the session, in the camp zone', () => {
    // 09:00 and 12:00 on 5 July in London (BST, UTC+1).
    expect(
      classWithinSession({ startsAt: '2027-07-05T08:00:00Z', endsAt: '2027-07-05T11:00:00Z' }, session, zone),
    ).toBe(true);
    expect(
      classWithinSession({ startsAt: '2027-07-18T08:00:00Z', endsAt: '2027-07-18T11:00:00Z' }, session, zone),
    ).toBe(true);
  });

  it('refuses a class that starts before the session or ends after it', () => {
    expect(
      classWithinSession({ startsAt: '2027-07-04T10:00:00Z', endsAt: '2027-07-04T12:00:00Z' }, session, zone),
    ).toBe(false);
    expect(
      classWithinSession({ startsAt: '2027-07-18T22:00:00Z', endsAt: '2027-07-19T01:00:00Z' }, session, zone),
    ).toBe(false);
  });

  it('reads the day in the camp zone, not in UTC', () => {
    // 23:30 UTC on 4 July is 00:30 on 5 July in London, so it is inside the session.
    expect(
      classWithinSession({ startsAt: '2027-07-04T23:30:00Z', endsAt: '2027-07-05T02:00:00Z' }, session, zone),
    ).toBe(true);
  });
});
