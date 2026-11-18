import { describe, expect, it } from 'vitest';
import { isPlausibleEmail, isPlausiblePhone, OptionalEmailSchema, OptionalPhoneSchema } from './contact';
import { NewPersonInputSchema, PersonPatchInputSchema } from './people';

describe('email format', () => {
  it.each([
    'name@example.com',
    'first.last+camp@sub.example.co.uk',
    "o'brien@example.org",
    'a-b_c@x-y.io',
    'x@example.museum',
  ])('accepts %s', email => expect(isPlausibleEmail(email)).toBe(true));

  it.each([
    ['no at sign', 'nameexample.com'],
    ['no domain', 'name@'],
    ['no top-level domain', 'name@example'],
    ['numeric top-level domain', 'name@example.1'],
    ['a space', 'name @example.com'],
    ['a leading dot in the local part', '.name@example.com'],
    ['a double dot', 'na..me@example.com'],
    ['an empty label', 'name@example..com'],
    ['a label that starts with a hyphen', 'name@-example.com'],
    ['two at signs', 'a@b@example.com'],
    ['a local part over 64 characters', `${'a'.repeat(65)}@example.com`],
    ['more than 254 characters', `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`],
  ])('refuses %s', (_, email) => expect(isPlausibleEmail(email)).toBe(false));
});

describe('phone format', () => {
  it.each(['+44 20 7946 0958', '020 7946 0958', '(555) 123-4567', '+1.555.123.4567', '07700900123', '+4915112345678'])(
    'accepts %s',
    phone => expect(isPlausiblePhone(phone)).toBe(true),
  );

  it.each([
    ['letters', 'call me'],
    ['too few digits', '12345'],
    ['too many digits', '+1234567890123456'],
    ['a plus in the middle', '020+7946 0958'],
    ['a leading space before the digits', ' 0207946'],
    ['a URL', 'tel:+4420'],
    ['over 32 characters', '1'.repeat(33)],
  ])('refuses %s', (_, phone) => expect(isPlausiblePhone(phone)).toBe(false));
});

describe('shared schemas used by people', () => {
  it('create: an empty email or phone means none; a typo is a field error with a message', () => {
    expect(OptionalEmailSchema.parse('')).toBeUndefined();
    expect(OptionalPhoneSchema.parse('   ')).toBeUndefined();
    expect(() => OptionalEmailSchema.parse('mum@example')).toThrow(/valid email/);
    expect(() => OptionalPhoneSchema.parse('abc')).toThrow(/valid phone/);
  });

  it('new person: rejects a bad email with the field named, and accepts a good one', () => {
    const base = { givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] };
    expect(NewPersonInputSchema.safeParse({ ...base, email: 'ada@example' }).success).toBe(false);
    expect(
      NewPersonInputSchema.safeParse({ ...base, email: 'ada@example.com', phone: '+44 20 7946 0958' }).success,
    ).toBe(true);
  });

  it('patch: an empty value is still passed on, and a non-empty bad value is refused', () => {
    expect(PersonPatchInputSchema.parse({ email: '' })).toEqual({ email: '' });
    expect(PersonPatchInputSchema.parse({ email: null, phone: null })).toEqual({ email: null, phone: null });
    expect(PersonPatchInputSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(PersonPatchInputSchema.safeParse({ phone: 'nope' }).success).toBe(false);
  });
});
