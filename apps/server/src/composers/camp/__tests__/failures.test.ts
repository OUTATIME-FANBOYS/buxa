import { describe, expect, it } from 'vitest';
import type { Session } from '../../../auth/session';
import { badRequest, conflict, forbidden } from '../../../http/errors';
import { SLUG_TAKEN, expectedCampFailure, membershipOf } from '../failures';

describe('camp action failures', () => {
  it('finds a posted camp only among the signed-in person’s memberships', () => {
    const session = { memberships: [{ orgId: 'o-1', role: 'owner' }] } as unknown as Session;
    expect(membershipOf(session, 'o-1')).toEqual({ orgId: 'o-1', role: 'owner' });
    expect(membershipOf(session, 'o-2')).toBeNull();
  });
  it('turns a taken address into a field error on the slug', () => {
    expect(expectedCampFailure(conflict('taken'), 'fallback')).toEqual({
      status: 'error',
      message: SLUG_TAKEN,
      fieldErrors: { slug: SLUG_TAKEN },
    });
  });
  it('explains a role that may not do this', () => {
    expect(expectedCampFailure(forbidden('no'), 'fallback')).toEqual({
      status: 'error',
      message: 'Your role cannot do this.',
    });
  });
  it('uses the fallback for other client errors', () => {
    expect(expectedCampFailure(badRequest('bad'), 'Could not save.')).toEqual({
      status: 'error',
      message: 'Could not save.',
    });
  });
  it('rethrows anything that is not an expected failure', () => {
    expect(() => expectedCampFailure(new Error('db down'), 'fallback')).toThrow('db down');
  });
});
