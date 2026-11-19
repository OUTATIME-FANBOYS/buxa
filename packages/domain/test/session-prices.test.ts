import { describe, expect, it } from 'vitest';
import { campToday, can, formatMoney, minorToInput, parseMoney, shownPrice, type SessionPrice } from '../src';

describe('parseMoney', () => {
  it('reads whole and decimal amounts as minor units, with no float error', () => {
    expect(parseMoney('45', 'USD')).toEqual({ ok: true, minor: 4500 });
    expect(parseMoney('45.5', 'USD')).toEqual({ ok: true, minor: 4550 });
    expect(parseMoney('0.10', 'USD')).toEqual({ ok: true, minor: 10 });
    // 0.1 + 0.2 style inputs: the text is read digit by digit, so 19.99 is exactly 1999 cents.
    expect(parseMoney('19.99', 'USD')).toEqual({ ok: true, minor: 1999 });
    expect(parseMoney('1,234.50', 'USD')).toEqual({ ok: true, minor: 123450 });
  });

  it('refuses extra decimal places instead of rounding them', () => {
    expect(parseMoney('12.345', 'USD')).toEqual({ ok: false, reason: 'precision' });
    expect(parseMoney('12.5', 'JPY')).toEqual({ ok: false, reason: 'precision' });
  });

  it('accepts trailing zeros beyond the currency places, because they change nothing', () => {
    expect(parseMoney('12.500', 'USD')).toEqual({ ok: true, minor: 1250 });
    expect(parseMoney('1200.000', 'JPY')).toEqual({ ok: true, minor: 1200 });
  });

  it('uses the currency exponent: yen has no minor unit, dinar has three', () => {
    expect(parseMoney('1200', 'JPY')).toEqual({ ok: true, minor: 1200 });
    expect(parseMoney('12.345', 'KWD')).toEqual({ ok: true, minor: 12345 });
  });

  it('refuses text that is not a plain positive amount, and amounts above the stored maximum', () => {
    for (const bad of ['', '-5', 'abc', '1.2.3', '5e2', '.5']) {
      expect(parseMoney(bad, 'USD').ok, bad).toBe(false);
    }
    expect(parseMoney('999999999.99', 'USD')).toEqual({ ok: true, minor: 99_999_999_999 });
    expect(parseMoney('1000000000.00', 'USD')).toEqual({ ok: false, reason: 'range' });
  });
});

describe('formatMoney', () => {
  it('shows two places for dollars and none for yen, with thousands separators', () => {
    expect(formatMoney(4500, 'USD')).toBe('$45.00');
    expect(formatMoney(123450, 'USD')).toBe('$1,234.50');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(1235, 'JPY')).toBe('¥1,235');
    expect(formatMoney(12345, 'KWD')).toBe('KWD12.345');
  });

  it('round-trips with parseMoney for every amount in a sample, without drift', () => {
    for (const minor of [0, 1, 9, 10, 99, 100, 1999, 123456, 99_999_999_999]) {
      const shown = formatMoney(minor, 'USD').replace(/[$,]/g, '');
      expect(parseMoney(shown, 'USD'), shown).toEqual({ ok: true, minor });
    }
  });

  it('refuses a value that is not a whole number of minor units', () => {
    expect(() => formatMoney(12.5, 'USD')).toThrow(RangeError);
  });
});

describe('minorToInput', () => {
  it('writes the amount the form starts with, and round-trips through parseMoney', () => {
    expect(minorToInput(4500, 'USD')).toBe('45.00');
    expect(minorToInput(5, 'USD')).toBe('0.05');
    expect(minorToInput(1235, 'JPY')).toBe('1235');
    for (const minor of [0, 7, 1999, 123456]) {
      expect(parseMoney(minorToInput(minor, 'USD'), 'USD')).toEqual({ ok: true, minor });
    }
  });
});

describe('the permission for setting a price', () => {
  it('is classes:manage: staff and above may set it, a viewer may not', () => {
    expect(can({ userId: 'u', orgId: 'o', role: 'staff' }, 'classes:manage')).toBe(true);
    expect(can({ userId: 'u', orgId: 'o', role: 'viewer' }, 'classes:manage')).toBe(false);
  });
});

describe('early-bird switch', () => {
  const zone = 'America/Los_Angeles';
  // Camp day 5 July 2027 in Los Angeles is PDT (UTC-7). 2027-07-05T23:30 local is 2027-07-06 06:30 UTC.
  const price: SessionPrice = {
    currency: 'USD',
    regularMinor: 45000,
    earlyBirdMinor: 39900,
    earlyBirdUntil: '2027-07-05',
  };

  it('uses the camp day, not the UTC day, so 23:30 on the boundary day is still early-bird', () => {
    const lateOnBoundary = new Date('2027-07-06T06:30:00Z');
    expect(campToday(lateOnBoundary, zone)).toBe('2027-07-05');
    expect(shownPrice(price, campToday(lateOnBoundary, zone))).toEqual({
      currency: 'USD',
      amountMinor: 39900,
      earlyBird: true,
    });
  });

  it('switches to the regular price at the start of the next camp day', () => {
    const justAfter = new Date('2027-07-06T07:00:00Z'); // 00:00 on 6 July in Los Angeles
    expect(campToday(justAfter, zone)).toBe('2027-07-06');
    expect(shownPrice(price, campToday(justAfter, zone))).toEqual({
      currency: 'USD',
      amountMinor: 45000,
      earlyBird: false,
    });
  });

  it('is early-bird on the first day and up to the end date, inclusive', () => {
    expect(shownPrice(price, '2027-06-01')?.earlyBird).toBe(true);
    expect(shownPrice(price, '2027-07-05')?.earlyBird).toBe(true);
    expect(shownPrice(price, '2027-07-06')?.earlyBird).toBe(false);
  });

  it('shows the regular price when there is no early-bird amount or no end date, and nothing when there is no price', () => {
    expect(shownPrice({ ...price, earlyBirdMinor: null, earlyBirdUntil: null }, '2027-06-01')?.amountMinor).toBe(45000);
    expect(shownPrice(null, '2027-06-01')).toBeNull();
  });
});
