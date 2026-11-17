import { describe, expect, it } from 'vitest';
import { CONFIRM_EMAIL_MESSAGE, describeSignInError, describeSignUpError, isAlreadyRegistered } from '../messages';

describe('sign-up answers for an existing address (audit S-10)', () => {
  it.each([
    'User already registered',
    'user_already_exists',
    'A user with this email address has already been registered',
  ])('recognises Supabase\'s "already registered" answer: %s', message => {
    expect(isAlreadyRegistered(message)).toBe(true);
  });

  it('does not treat other sign-up errors as already registered', () => {
    expect(isAlreadyRegistered('Password should be at least 8 characters')).toBe(false);
    expect(isAlreadyRegistered('Signups not allowed for this instance')).toBe(false);
  });

  it('the generic sign-up message never mentions an existing account', () => {
    expect(describeSignUpError('Signups not allowed for this instance')).not.toMatch(/already|registered|exists/i);
    expect(CONFIRM_EMAIL_MESSAGE).not.toMatch(/already|registered|exists/i);
  });
});

describe('sign-in answers do not reveal whether an address has an account', () => {
  it('an unknown address and a wrong password get the same message (Supabase answers both the same way)', () => {
    const unknownAddress = describeSignInError('Invalid login credentials');
    const wrongPassword = describeSignInError('Invalid login credentials');
    expect(unknownAddress).toBe(wrongPassword);
    expect(unknownAddress).toBe('That email and password do not match.');
  });

  it('the confirm-email message is shown only to the sign-in attempt that passed the password check', () => {
    expect(describeSignInError('Email not confirmed')).toBe('Confirm your email first. Check your inbox for the link.');
  });
});
