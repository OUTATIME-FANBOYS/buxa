import { describe, expect, it } from 'vitest';
import { earlyBirdFromDiscount } from '../src';

describe('earlyBirdFromDiscount: a percentage off the regular price', () => {
  it('leaves the price after the percentage, in minor units', () => {
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'percent', value: '10' })).toEqual({ ok: true, minor: 4050 });
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'percent', value: '12.5' })).toEqual({ ok: true, minor: 3938 });
  });

  it('rounds half up to the nearest minor unit, and never below one', () => {
    // 1 cent at 50% off: 0.5 rounds up to 1, so the price is not zero.
    expect(earlyBirdFromDiscount(1, 'USD', { kind: 'percent', value: '50' })).toEqual({ ok: true, minor: 1 });
    expect(earlyBirdFromDiscount(1001, 'USD', { kind: 'percent', value: '50' })).toEqual({ ok: true, minor: 501 });
  });

  it('refuses 0% and 100%, because the price would not be above zero', () => {
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'percent', value: '0' })).toEqual({
      ok: false,
      reason: 'not-positive',
    });
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'percent', value: '100' })).toEqual({
      ok: false,
      reason: 'format',
    });
  });

  it('refuses text that is not a percentage with at most two decimals', () => {
    for (const bad of ['', 'ten', '-5', '10.555', '.5', '150']) {
      expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'percent', value: bad }).ok).toBe(false);
    }
  });
});

describe('earlyBirdFromDiscount: an amount off the regular price', () => {
  it('subtracts the amount, read as money in the currency', () => {
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: '5' })).toEqual({ ok: true, minor: 4000 });
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: '4.99' })).toEqual({ ok: true, minor: 4001 });
    expect(earlyBirdFromDiscount(4500, 'JPY', { kind: 'amount', value: '500' })).toEqual({ ok: true, minor: 4000 });
  });

  it('refuses an amount that takes the price to zero or below', () => {
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: '45' })).toEqual({
      ok: false,
      reason: 'not-positive',
    });
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: '60' })).toEqual({
      ok: false,
      reason: 'not-positive',
    });
  });

  it('passes through the money reasons for an amount it cannot read', () => {
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: '1.234' })).toEqual({
      ok: false,
      reason: 'precision',
    });
    expect(earlyBirdFromDiscount(4500, 'USD', { kind: 'amount', value: 'abc' })).toEqual({
      ok: false,
      reason: 'format',
    });
  });
});
