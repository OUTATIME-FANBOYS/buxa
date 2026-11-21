import { describe, expect, it } from 'vitest';
import { sessionForm, sessionPriceForm } from '../parse';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.append(name, value);
  }

  return data;
};

const base = { name: 'Summer camp', startsOn: '2027-07-01', endsOn: '2027-07-31' };

describe('session price form', () => {
  it('reads a blank price as no price', () => {
    const parsed = sessionPriceForm(form({ priceAmount: '' }));
    expect(parsed.ok && parsed.data).toBeNull();
  });

  it('turns the typed amount into minor units in the chosen currency, defaulting to USD', () => {
    const parsed = sessionPriceForm(form({ priceAmount: '1,234.50', priceCurrency: 'aud' }));
    expect(parsed.ok && parsed.data).toEqual({
      currency: 'AUD',
      regularMinor: 123450,
      earlyBirdMinor: null,
      earlyBirdUntil: null,
    });
    const usd = sessionPriceForm(form({ priceAmount: '45' }));
    expect(usd.ok && usd.data).toEqual({
      currency: 'USD',
      regularMinor: 4500,
      earlyBirdMinor: null,
      earlyBirdUntil: null,
    });
  });

  it('refuses extra decimal places with a message, rather than rounding', () => {
    const parsed = sessionPriceForm(form({ priceAmount: '12.345' }));
    expect(parsed.ok).toBe(false);
    const priceError: unknown = expect.stringMatching(/fewer decimal places/);
    expect(parsed.ok ? null : parsed.state).toMatchObject({
      fieldErrors: { priceAmount: priceError },
    });
  });

  it('needs the early-bird amount and its last day together', () => {
    const onlyAmount = sessionPriceForm(form({ priceAmount: '450', earlyBirdAmount: '399' }));
    expect(onlyAmount.ok).toBe(false);
    const onlyDay = sessionPriceForm(form({ priceAmount: '450', earlyBirdUntil: '2027-07-05' }));
    expect(onlyDay.ok).toBe(false);
  });

  it('refuses an early-bird price above the regular price', () => {
    const parsed = sessionPriceForm(form({ priceAmount: '350', earlyBirdAmount: '399', earlyBirdUntil: '2027-07-05' }));
    expect(parsed.ok).toBe(false);
  });

  it('is part of the create-session form, and a session form without a price still parses', () => {
    const withPrice = sessionForm(
      form({ ...base, priceAmount: '450', earlyBirdAmount: '399', earlyBirdUntil: '2027-07-05' }),
    );
    expect(withPrice.ok && withPrice.data.price).toEqual({
      currency: 'USD',
      regularMinor: 45000,
      earlyBirdMinor: 39900,
      earlyBirdUntil: '2027-07-05',
    });
    const without = sessionForm(form(base));
    expect(without.ok && without.data.price).toBeNull();
  });
});
