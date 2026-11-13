import { describe, expect, it } from 'vitest';
import { validateCampName, validateNewCamp, validateSignIn } from './validators';

const fields = { name: 'Ann', email: 'ann@camp.test', password: 'longenough1' };

describe('validateSignIn', () => {
  it('accepts valid sign-in and sign-up', () => {
    expect(validateSignIn('in', { ...fields, name: '' })).toEqual({});
    expect(validateSignIn('up', fields)).toEqual({});
  });
  it('sign-in needs only a valid email and some password', () => {
    expect(validateSignIn('in', { name: '', email: 'nope', password: '' })).toEqual({ email: 'Enter a valid email address.', password: 'Enter your password.' });
    expect(validateSignIn('in', { name: '', email: 'a@b.co', password: 'x' })).toEqual({});
  });
  it('sign-up also needs a name and an 8-character password', () => {
    expect(validateSignIn('up', { name: '  ', email: 'a@b.co', password: 'short' })).toEqual({ name: 'Tell us what to call you.', password: 'Use at least 8 characters.' });
  });
});

describe('validateNewCamp (uses the same contract as the server)', () => {
  it('accepts a good name and address', () => expect(validateNewCamp({ name: 'Sunrise', slug: 'sunrise-lake' })).toEqual({}));
  it('reports an empty name and a bad address per field', () => {
    const errors = validateNewCamp({ name: '  ', slug: 'Bad Slug' });
    expect(errors.name).toBe('Give your camp a name.');
    expect(errors.slug).toMatch(/3–50 lowercase/);
  });
  it('rejects an address that is too short or has a leading dash', () => {
    expect(validateNewCamp({ name: 'x', slug: 'ab' }).slug).toBeDefined();
    expect(validateNewCamp({ name: 'x', slug: '-abc' }).slug).toBeDefined();
  });
});

describe('validateCampName', () => {
  it('is undefined for a good name and a message for a blank or over-long one', () => {
    expect(validateCampName('Lake')).toBeUndefined();
    expect(validateCampName('   ')).toBe('Give your camp a name.');
    expect(validateCampName('x'.repeat(121))).toBeDefined();
  });
});
