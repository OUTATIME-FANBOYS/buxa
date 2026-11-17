import { describe, expect, it } from 'vitest';
import { parseCampLocal } from './campTime';

const SYDNEY = 'Australia/Sydney';

describe('parseCampLocal (camp-local ISO times, no offset)', () => {
  it('reads a local time in the camp zone as the matching instant', () => {
    // July is winter in Sydney: UTC+10, so 09:00 local is 23:00 the day before in UTC.
    expect(parseCampLocal('2027-07-05T09:00', SYDNEY)).toEqual({ ok: true, instant: '2027-07-04T23:00:00.000Z' });
  });

  it('follows daylight saving: the same clock time in January is UTC+11', () => {
    expect(parseCampLocal('2027-01-10T09:00', SYDNEY)).toEqual({ ok: true, instant: '2027-01-09T22:00:00.000Z' });
  });

  it('accepts seconds', () => {
    expect(parseCampLocal('2027-07-05T09:00:30', SYDNEY)).toEqual({ ok: true, instant: '2027-07-04T23:00:30.000Z' });
  });

  it('uses the zone it is given (a UTC camp keeps the clock time)', () => {
    expect(parseCampLocal('2027-07-05T09:00', 'UTC')).toEqual({ ok: true, instant: '2027-07-05T09:00:00.000Z' });
  });

  it('refuses an offset: times are in the camp zone', () => {
    expect(parseCampLocal('2027-07-05T09:00+10:00', SYDNEY)).toEqual({
      ok: false, message: 'Leave off the time zone. Times are in the camp\'s time zone.',
    });
    expect(parseCampLocal('2027-07-05T09:00Z', SYDNEY).ok).toBe(false);
  });

  it('refuses a value that is not ISO, with the format to use', () => {
    expect(parseCampLocal('5/7/2027 9am', SYDNEY)).toEqual({ ok: false, message: 'Use the format 2027-07-05T09:00 (camp time).' });
    expect(parseCampLocal('2027-07-05 09:00', SYDNEY).ok).toBe(false);
  });

  it('refuses an empty value', () => {
    expect(parseCampLocal('  ', SYDNEY)).toEqual({ ok: false, message: 'Enter a date and time.' });
  });

  it('refuses a day that does not exist and an out-of-range clock', () => {
    expect(parseCampLocal('2027-02-30T09:00', SYDNEY).ok).toBe(false);
    expect(parseCampLocal('2027-07-05T24:00', SYDNEY).ok).toBe(false);
    expect(parseCampLocal('2027-07-05T09:60', SYDNEY).ok).toBe(false);
  });
});
