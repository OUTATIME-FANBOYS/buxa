import { describe, expect, it } from 'vitest';
import {
  HOLD_MINUTES_MAX,
  HOLD_MINUTES_MIN,
  SEAT_HOLD_MINUTES,
  holdExpiresAt,
  holdLengthMinutes,
  isHoldActive,
  isValidHoldMinutes,
} from '../src';

const at = (iso: string) => new Date(iso);

describe('seat hold timing', () => {
  it('the hold length is 15 minutes', () => {
    expect(SEAT_HOLD_MINUTES).toBe(15);
  });

  it('a hold taken now expires exactly the hold length later', () => {
    const now = at('2027-07-05T09:00:00Z');
    expect(holdExpiresAt(now)).toEqual(at('2027-07-05T09:15:00Z'));
  });

  it('an unreleased hold is active until its time, and stops at it', () => {
    const hold = { releasedAt: null, expiresAt: at('2027-07-05T09:15:00Z') };
    expect(isHoldActive(hold, at('2027-07-05T09:14:59Z'))).toBe(true);
    expect(isHoldActive(hold, at('2027-07-05T09:15:00Z'))).toBe(false);
    expect(isHoldActive(hold, at('2027-07-05T10:00:00Z'))).toBe(false);
  });

  it('a released hold is never active, even before its time', () => {
    const hold = { releasedAt: at('2027-07-05T09:01:00Z'), expiresAt: at('2027-07-05T09:15:00Z') };
    expect(isHoldActive(hold, at('2027-07-05T09:02:00Z'))).toBe(false);
  });
});

describe('seat hold length per camp', () => {
  it('accepts whole minutes from 5 to 60 only', () => {
    expect(HOLD_MINUTES_MIN).toBe(5);
    expect(HOLD_MINUTES_MAX).toBe(60);
    expect(isValidHoldMinutes(5)).toBe(true);
    expect(isValidHoldMinutes(60)).toBe(true);
    expect(isValidHoldMinutes(30)).toBe(true);
    for (const value of [4, 0, -1, 61, 7.5, Number.NaN]) {
      expect(isValidHoldMinutes(value)).toBe(false);
    }
  });

  it('a null setting means the default, 15 minutes', () => {
    expect(holdLengthMinutes(null)).toBe(SEAT_HOLD_MINUTES);
    expect(holdLengthMinutes(45)).toBe(45);
  });

  it('a hold expires after the length it is given, and after the default when none is given', () => {
    const now = at('2027-07-05T09:00:00Z');
    expect(holdExpiresAt(now, 45)).toEqual(at('2027-07-05T09:45:00Z'));
    expect(holdExpiresAt(now)).toEqual(at('2027-07-05T09:15:00Z'));
  });
});
