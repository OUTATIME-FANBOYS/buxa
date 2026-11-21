import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { instantToLocalInput, localInputToInstant } from '../localTime';

// The browser's zone decides the conversion. Node reads a changed TZ at run time, so each test sets the zone it needs.
const originalZone = process.env.TZ;
const inZone = (zone: string) => {
  process.env.TZ = zone;
};

beforeEach(() => inZone('Europe/London'));
afterEach(() => {
  if (originalZone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalZone;
  }
});

describe('localInputToInstant and instantToLocalInput: a round trip in the browser zone', () => {
  it('reads a winter local time as the same UTC instant (London is UTC in January)', () => {
    expect(localInputToInstant('2027-01-15T09:00')).toBe('2027-01-15T09:00:00.000Z');
    expect(instantToLocalInput('2027-01-15T09:00:00.000Z')).toBe('2027-01-15T09:00');
  });

  it('round-trips every local time through UTC without change', () => {
    for (const local of ['2027-07-05T09:00', '2027-07-05T23:59', '2027-12-31T00:00']) {
      const instant = localInputToInstant(local);
      expect(instant).not.toBeNull();
      expect(instantToLocalInput(instant ?? '')).toBe(local);
    }
  });

  it('refuses text that is not a local date-time, and a date that does not exist', () => {
    expect(localInputToInstant('2027-07-05 09:00')).toBeNull();
    expect(localInputToInstant('2027-07-05T09:00Z')).toBeNull();
    expect(localInputToInstant('')).toBeNull();
    expect(localInputToInstant('2027-02-30T10:00')).toBeNull();
  });
});

describe('localInputToInstant: a day when the clocks change (London, 28 March 2027)', () => {
  // At 01:00 UTC the clocks go forward from 01:00 GMT to 02:00 BST, so local 01:00 to 01:59 does not exist.
  it('refuses a local time that the clocks skipped, rather than saving a different time', () => {
    expect(localInputToInstant('2027-03-28T01:30')).toBeNull();
  });

  it('reads the hours either side of the change with the offset in force then', () => {
    expect(localInputToInstant('2027-03-28T00:30')).toBe('2027-03-28T00:30:00.000Z');
    expect(localInputToInstant('2027-03-28T09:00')).toBe('2027-03-28T08:00:00.000Z');
  });

  it('shows an instant on the changed day in the local time in force at that instant', () => {
    expect(instantToLocalInput('2027-03-28T08:00:00.000Z')).toBe('2027-03-28T09:00');
  });
});

describe('localInputToInstant: a zone with a half-hour offset (Kolkata, UTC+05:30)', () => {
  beforeEach(() => inZone('Asia/Kolkata'));

  it('subtracts the half hour when it saves, and adds it back when it shows', () => {
    expect(localInputToInstant('2027-07-05T09:00')).toBe('2027-07-05T03:30:00.000Z');
    expect(instantToLocalInput('2027-07-05T03:30:00.000Z')).toBe('2027-07-05T09:00');
  });
});
