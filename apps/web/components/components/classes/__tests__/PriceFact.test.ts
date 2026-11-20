import { describe, expect, it } from 'vitest';
import { priceSummary } from '../PriceFact';

const ZONE = 'Australia/Sydney';
const price = {
  currency: 'AUD',
  regularMinor: 45000,
  earlyBirdMinor: 39900,
  earlyBirdUntil: '2027-07-05',
};

describe('priceSummary', () => {
  it('says "Not set" when the session has no price', () => {
    expect(priceSummary(null, ZONE, new Date('2027-06-01T00:00:00Z'))).toBe('Not set');
  });

  it('shows the early-bird amount on its last day in the camp zone, and the regular price after it', () => {
    // 5 July 2027 at 23:30 in Sydney (AEST, UTC+10) is 13:30 UTC on the same day.
    expect(priceSummary(price, ZONE, new Date('2027-07-05T13:30:00Z'))).toBe(
      '$399.00 early-bird until 2027-07-05, then $450.00',
    );
    // 00:30 on 6 July in Sydney is 14:30 UTC on 5 July: the early-bird day is over.
    expect(priceSummary(price, ZONE, new Date('2027-07-05T14:30:00Z'))).toBe(
      '$450.00. The early-bird price ended 2027-07-05',
    );
  });

  it('shows only the regular price when there is no early-bird amount', () => {
    expect(priceSummary({ ...price, earlyBirdMinor: null, earlyBirdUntil: null }, ZONE)).toBe('$450.00');
  });
});
