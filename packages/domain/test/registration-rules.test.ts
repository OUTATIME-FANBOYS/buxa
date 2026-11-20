import { describe, expect, it } from 'vitest';
import { decideConfirmation, decideRegistration } from '../src';

const base = { publishedVersion: 1, formSessionIds: ['s1', 's2'], requestedSessionIds: ['s1'] };

describe('registration rules', () => {
  it('allows a registration for one or more sessions in the form', () => {
    expect(decideRegistration(base)).toEqual({ allow: true });
    expect(decideRegistration({ ...base, requestedSessionIds: ['s1', 's2', 's1'] })).toEqual({ allow: true });
  });

  it('refuses a form that was never published', () => {
    expect(decideRegistration({ ...base, publishedVersion: null })).toEqual({
      allow: false,
      reason: 'form_not_published',
    });
  });

  it('refuses a registration with no sessions', () => {
    expect(decideRegistration({ ...base, requestedSessionIds: [] })).toEqual({ allow: false, reason: 'no_sessions' });
  });

  it('refuses a session outside the form session set, even when one of several is inside', () => {
    expect(decideRegistration({ ...base, requestedSessionIds: ['s1', 'other'] })).toEqual({
      allow: false,
      reason: 'session_not_in_form',
    });
  });
});

describe('registration confirmation rule', () => {
  it('allows the confirmation of a pending registration', () => {
    expect(decideConfirmation('pending')).toEqual({ allow: true });
  });

  it('refuses a second confirmation of a registration that is already confirmed', () => {
    expect(decideConfirmation('confirmed')).toEqual({ allow: false, reason: 'already_confirmed' });
  });
});
