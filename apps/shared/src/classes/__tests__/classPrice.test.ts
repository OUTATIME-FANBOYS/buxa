import { describe, expect, it } from 'vitest';
import { classForm, sessionForm } from '../parse';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.append(name, value);
  }

  return data;
};

// A class form with every required field filled in; a price is added to it per test.
const classBase = {
  name: 'Painting',
  minAge: '8',
  maxAge: '12',
  capacity: '10',
  startsAt: '2027-07-05T09:00:00+10:00',
  endsAt: '2027-07-05T12:00:00+10:00',
  location: 'Studio',
};
const sessionBase = { name: 'Summer camp', startsOn: '2027-07-01', endsOn: '2027-07-31' };

describe('class price form', () => {
  it('reads a blank price as no price', () => {
    const parsed = classForm(form(classBase));
    expect(parsed.ok && parsed.data.price).toBeNull();
  });

  it('turns the typed amount into minor units in the chosen currency, defaulting to USD', () => {
    const parsed = classForm(form({ ...classBase, priceAmount: '1,234.50', priceCurrency: 'aud' }));
    expect(parsed.ok && parsed.data.price).toEqual({
      currency: 'AUD',
      regularMinor: 123450,
      earlyBirdMinor: null,
      earlyBirdUntil: null,
    });
    const usd = classForm(form({ ...classBase, priceAmount: '45' }));
    expect(usd.ok && usd.data.price).toEqual({
      currency: 'USD',
      regularMinor: 4500,
      earlyBirdMinor: null,
      earlyBirdUntil: null,
    });
  });

  it('refuses extra decimal places with a message, rather than rounding', () => {
    const parsed = classForm(form({ ...classBase, priceAmount: '12.345' }));
    expect(parsed.ok).toBe(false);
    const priceError: unknown = expect.stringMatching(/fewer decimal places/);
    expect(parsed.ok ? null : parsed.state).toMatchObject({ fieldErrors: { priceAmount: priceError } });
  });

  it('needs the early-bird amount and its last day together', () => {
    const onlyAmount = classForm(form({ ...classBase, priceAmount: '450', earlyBirdAmount: '399' }));
    expect(onlyAmount.ok).toBe(false);
    const onlyDay = classForm(form({ ...classBase, priceAmount: '450', earlyBirdUntil: '2027-07-05' }));
    expect(onlyDay.ok).toBe(false);
  });

  it('refuses an early-bird price above the regular price', () => {
    const parsed = classForm(
      form({ ...classBase, priceAmount: '350', earlyBirdAmount: '399', earlyBirdUntil: '2027-07-05' }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('accepts an early-bird price with its last day, on the class', () => {
    const parsed = classForm(
      form({ ...classBase, priceAmount: '450', earlyBirdAmount: '399', earlyBirdUntil: '2027-07-05' }),
    );
    expect(parsed.ok && parsed.data.price).toEqual({
      currency: 'USD',
      regularMinor: 45000,
      earlyBirdMinor: 39900,
      earlyBirdUntil: '2027-07-05',
    });
  });

  it('a session form takes no price: a price posted with it is ignored', () => {
    const parsed = sessionForm(
      form({ ...sessionBase, priceAmount: '450', earlyBirdAmount: '399', earlyBirdUntil: '2027-07-05' }),
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && 'price' in parsed.data).toBe(false);
  });
});
