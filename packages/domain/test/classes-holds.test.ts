import { describe, expect, it } from 'vitest';
import { SEAT_HOLD_MINUTES, holdExpiresAt, isHoldActive } from '../src';

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
