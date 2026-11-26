import { describe, expect, it } from 'vitest';
import {
  EMAIL_MESSAGE,
  PHONE_NUMBER_MESSAGE,
  isPlausibleEmail,
  isPlausiblePhone,
  isValidPhone,
  OptionalEmailSchema,
  PatchPhoneSchema,
  PersonPhoneSchema,
} from './contact';
import { NewPersonFormSchema, NewPersonInputSchema, PersonPatchInputSchema } from './people';

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

describe('person phone format (the add and edit person form)', () => {
  it.each([
    '0400 000 000',
    '+44 20 7946 0958',
    '(555) 123-4567',
    '+1 (555) 123-4567',
    '07700900123',
    '+49151123456789',
  ])('accepts %s', phone => expect(isValidPhone(phone)).toBe(true));

  it.each([
    ['empty', ''],
    ['letters', 'call me'],
    ['six digits', '123456'],
    ['six digits with spaces and dashes', '12-34 56'],
    ['a plus that is not first', '020+7946 0958'],
    ['a dot, which this form does not take', '020.7946.0958'],
    ['a plus with no digits', '+'],
    ['33 characters as typed', '1'.repeat(33)],
    ['a leading space', ' 0207946'],
  ])('refuses %s', (_, phone) => expect(isValidPhone(phone)).toBe(false));
});

describe('phone format (the emergency contact)', () => {
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
  it('email: an empty value means none on add, and a typo gets the email message', () => {
    expect(OptionalEmailSchema.parse('')).toBeUndefined();
    expect(() => OptionalEmailSchema.parse('mum@example')).toThrow(EMAIL_MESSAGE);
  });

  it('phone: required on add, with the person message when it is empty or too short', () => {
    expect(PersonPhoneSchema.safeParse('').error?.issues[0]?.message).toBe(PHONE_NUMBER_MESSAGE);
    expect(PersonPhoneSchema.safeParse('12345').error?.issues[0]?.message).toBe(PHONE_NUMBER_MESSAGE);
    expect(PersonPhoneSchema.parse('0400 000 000')).toBe('0400 000 000');
  });

  it('add person form: a bad email or phone is refused with its field message, and a good pair is accepted', () => {
    const base = { givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] };
    const badEmail = NewPersonFormSchema.safeParse({ ...base, email: 'ada@example', phone: '0400 000 000' });
    expect(badEmail.success).toBe(false);
    expect(badEmail.error?.issues.map(issue => issue.message)).toContain(EMAIL_MESSAGE);

    const noPhone = NewPersonFormSchema.safeParse({ ...base, email: 'ada@example.com' });
    expect(noPhone.error?.issues.map(issue => issue.message)).toContain(PHONE_NUMBER_MESSAGE);

    expect(
      NewPersonFormSchema.safeParse({ ...base, email: 'ada@example.com', phone: '+44 20 7946 0958' }).success,
    ).toBe(true);
  });

  it('service input: the phone is optional there, but a phone that is given must be valid', () => {
    const base = { givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] };
    expect(NewPersonInputSchema.safeParse(base).success).toBe(true);
    expect(NewPersonInputSchema.safeParse({ ...base, phone: 'call me' }).success).toBe(false);
  });

  it('patch: a blank phone or email is passed on unchanged; a non-empty bad value is refused with its message', () => {
    expect(PersonPatchInputSchema.parse({ email: '' })).toEqual({ email: '' });
    expect(PersonPatchInputSchema.parse({ email: null, phone: null })).toEqual({ email: null, phone: null });
    expect(PersonPatchInputSchema.parse({ phone: '' })).toEqual({ phone: '' });
    expect(PatchPhoneSchema.safeParse('nope').error?.issues[0]?.message).toBe(PHONE_NUMBER_MESSAGE);
    expect(PersonPatchInputSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(PersonPatchInputSchema.safeParse({ phone: 'nope' }).success).toBe(false);
  });
});
