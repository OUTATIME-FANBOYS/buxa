import { describe, expect, it } from 'vitest';
import { describeSignInError, describeSignUpError } from './messages';

describe('auth messages', () => {
  it.each([
    ['Invalid login credentials', 'That email and password do not match.'],
    ['Email not confirmed', 'Confirm your email first. Check your inbox for the link.'],
    ['Email rate limit exceeded', 'Too many attempts. Wait a minute and try again.'],
    ['something unexpected from the server', 'Could not sign in. Please try again.'],
  ])('sign-in: %j', (raw, shown) => expect(describeSignInError(raw)).toBe(shown));

  it.each([
    ['Password should be at least 6 characters', 'Choose a stronger password (at least 8 characters).'],
    ['Too many requests', 'Too many attempts. Wait a minute and try again.'],
    ['User already registered', 'Could not create the account. Please try again.'],
  ])('sign-up: %j', (raw, shown) => expect(describeSignUpError(raw)).toBe(shown));

  it('never reveals whether an address already has an account', () => {
    expect(describeSignUpError('User already registered')).not.toMatch(/already|registered|exists/i);
  });
});
