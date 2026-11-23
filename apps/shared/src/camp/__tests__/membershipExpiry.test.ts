import { describe, expect, it } from 'vitest';
import { EXPIRY_SOON_DAYS, expiryDay, expiryState } from '../membershipExpiry';

const now = new Date('2027-03-10T12:00:00.000Z');
const dayOffset = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

describe('expiryState', () => {
  it('is none for a null or missing expiry (no expiry)', () => {
    expect(expiryState(null, now)).toBe('none');
    expect(expiryState(undefined, now)).toBe('none');
  });

  it('is expired once the expiry instant has passed, and at that instant', () => {
    expect(expiryState(dayOffset(-1), now)).toBe('expired');
    expect(expiryState(now.toISOString(), now)).toBe('expired');
  });

  it('is soon while the expiry is within the 14-day window, and at its edge', () => {
    expect(EXPIRY_SOON_DAYS).toBe(14);
    expect(expiryState(dayOffset(1), now)).toBe('soon');
    expect(expiryState(dayOffset(14), now)).toBe('soon');
  });

  it('is later beyond 14 days', () => {
    expect(expiryState(dayOffset(14.5), now)).toBe('later');
  });
});

describe('expiryDay', () => {
  it('reads the chosen day back from the stored midnight-UTC instant', () => {
    expect(expiryDay('2027-04-01T00:00:00.000Z')).toBe('2027-04-01');
  });
});
