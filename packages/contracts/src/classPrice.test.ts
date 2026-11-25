import { describe, expect, it } from 'vitest';
import { ClassInputSchema, ClassPriceSchema, NewSessionInputSchema, NewSeriesInputSchema } from './classes';

// A price belongs to a class. These tests pin the contract: a session input refuses a price, and a class input accepts and checks
// one (the same checks as the database: the currency is three capital letters, the early bird is not above the price, and the early
// bird amount and its last day come together).

const times = { startsAt: '2027-07-05T09:00:00+10:00', endsAt: '2027-07-05T12:00:00+10:00' };
const classFields = {
  name: 'Painting',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 10,
  location: 'Studio',
  instructorIds: [] as string[],
};
const session = { name: 'Summer camp', description: '', startsOn: '2027-07-01', endsOn: '2027-07-31' };
const price = { currency: 'AUD', regularMinor: 45000, earlyBirdMinor: 39900, earlyBirdUntil: '2027-07-05' };

describe('session input has no price', () => {
  it('refuses a price sent with a session', () => {
    expect(NewSessionInputSchema.safeParse({ ...session, price }).success).toBe(false);
    expect(NewSessionInputSchema.safeParse({ ...session, price: null }).success).toBe(false);
  });

  it('accepts a session without one', () => {
    expect(NewSessionInputSchema.safeParse(session).success).toBe(true);
  });
});

describe('class input carries its own price', () => {
  it('accepts no price, a regular price, and a regular price with its early bird', () => {
    expect(ClassInputSchema.safeParse({ ...classFields, ...times, price: null }).success).toBe(true);
    expect(
      ClassInputSchema.safeParse({
        ...classFields,
        ...times,
        price: { ...price, earlyBirdMinor: null, earlyBirdUntil: null },
      }).success,
    ).toBe(true);
    expect(ClassInputSchema.safeParse({ ...classFields, ...times, price }).success).toBe(true);
  });

  it('treats a class with no price field as no price', () => {
    const parsed = ClassInputSchema.safeParse({ ...classFields, ...times });
    expect(parsed.success && parsed.data.price).toBeNull();
  });

  it('refuses a currency that is not three capital letters', () => {
    expect(ClassPriceSchema.safeParse({ ...price, currency: 'aud' }).success).toBe(false);
    expect(ClassPriceSchema.safeParse({ ...price, currency: 'AU' }).success).toBe(false);
    expect(
      ClassInputSchema.safeParse({ ...classFields, ...times, price: { ...price, currency: 'usd1' } }).success,
    ).toBe(false);
  });

  it('refuses an early bird above the regular price', () => {
    expect(ClassPriceSchema.safeParse({ ...price, earlyBirdMinor: 45001 }).success).toBe(false);
    expect(
      ClassInputSchema.safeParse({ ...classFields, ...times, price: { ...price, earlyBirdMinor: 50000 } }).success,
    ).toBe(false);
  });

  it('needs the early-bird amount and its last day together', () => {
    expect(ClassPriceSchema.safeParse({ ...price, earlyBirdUntil: null }).success).toBe(false);
    expect(ClassPriceSchema.safeParse({ ...price, earlyBirdMinor: null }).success).toBe(false);
  });

  it('refuses a negative amount', () => {
    expect(ClassPriceSchema.safeParse({ ...price, regularMinor: -1 }).success).toBe(false);
  });

  it('a series takes one price for every day it makes', () => {
    const series = NewSeriesInputSchema.safeParse({
      weekdays: [1],
      startsAt: '2027-07-05T09:00',
      endsAt: '2027-07-12T10:00',
      name: 'Painting',
      ageRange: { minAge: 8, maxAge: 12 },
      capacity: 10,
      location: 'Studio',
      price,
    });
    expect(series.success && series.data.price).toEqual(price);
  });
});
