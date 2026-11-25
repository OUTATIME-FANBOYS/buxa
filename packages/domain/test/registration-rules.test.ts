import { describe, expect, it } from 'vitest';
import { decideConfirmation, decideErasure, decideRegistration, decideWithdrawal } from '../src';

const base = {
  publishedVersion: 1,
  formSessionIds: ['s1', 's2'],
  requestedSessionIds: ['s1'],
  closedSessionIds: [] as string[],
};

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

describe('registration and the session status', () => {
  it('refuses a session that is a draft or archived, even when it is part of the form', () => {
    expect(decideRegistration({ ...base, closedSessionIds: ['s1'] })).toEqual({
      allow: false,
      reason: 'session_not_open',
    });
    expect(decideRegistration({ ...base, requestedSessionIds: ['s2'], closedSessionIds: ['s1'] })).toEqual({
      allow: true,
    });
  });
});

describe('registration withdrawal and erasure rules', () => {
  it('withdraws a pending or confirmed registration once', () => {
    expect(decideWithdrawal('pending')).toEqual({ allow: true });
    expect(decideWithdrawal('confirmed')).toEqual({ allow: true });
    expect(decideWithdrawal('withdrawn')).toEqual({ allow: false, reason: 'already_withdrawn' });
  });

  it('a confirmed registration with enrolments must be withdrawn before it is erased', () => {
    expect(decideErasure({ status: 'confirmed', activeEnrolments: 2 })).toEqual({
      allow: false,
      reason: 'withdraw_first',
    });
    expect(decideErasure({ status: 'confirmed', activeEnrolments: 0 })).toEqual({ allow: true });
    expect(decideErasure({ status: 'pending', activeEnrolments: 1 })).toEqual({ allow: true });
    expect(decideErasure({ status: 'withdrawn', activeEnrolments: 0 })).toEqual({ allow: true });
  });

  it('a withdrawn registration cannot be confirmed', () => {
    expect(decideConfirmation('withdrawn')).toEqual({ allow: false, reason: 'not_pending' });
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
