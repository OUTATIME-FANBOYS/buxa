import { describe, expect, it } from 'vitest';
import {
  decideEnrolment,
  describeRefusal,
  type ActiveEnrolmentFacts,
  type EnrolmentFacts,
  type EnrolmentOptions,
} from '../src';

const robotics = {
  sessionId: 's-robotics',
  className: 'Robotics',
  startsAt: '2027-07-05T09:00:00Z',
  endsAt: '2027-07-05T12:00:00Z',
};
const baseSession = { ...robotics, capacity: 2, ageRange: { minAge: 8, maxAge: 12 } };
const facts = (over: Partial<EnrolmentFacts> = {}): EnrolmentFacts => ({
  session: baseSession,
  seatsTaken: 0,
  camperDateOfBirth: '2016-01-01',
  sessionDay: '2027-07-05',
  camperActive: [],
  ...over,
});
const opts = (over: Partial<EnrolmentOptions> = {}): EnrolmentOptions => ({
  waitlistIfFull: false,
  override: null,
  actorCanOverride: false,
  ...over,
});
const painting: ActiveEnrolmentFacts = {
  sessionId: 's-painting',
  className: 'Painting',
  startsAt: '2027-07-05T11:00:00Z',
  endsAt: '2027-07-05T13:00:00Z',
};

describe('decideEnrolment: the happy path', () => {
  it('enrols when the camper is in range, there is a seat and nothing clashes', () => {
    expect(decideEnrolment(facts(), opts())).toEqual({ kind: 'allow', status: 'enrolled', overrode: null });
  });
});

describe('decideEnrolment: age (inclusive, never overridable)', () => {
  it('refuses a camper outside the range, with the age found on the session day', () => {
    expect(decideEnrolment(facts({ camperDateOfBirth: '2019-07-06' }), opts())).toEqual({
      kind: 'refuse',
      reason: 'age_out_of_range',
      age: 7,
      range: { minAge: 8, maxAge: 12 },
    });
  });
  it('accepts a camper exactly at the minimum', () => {
    expect(decideEnrolment(facts({ camperDateOfBirth: '2019-07-05' }), opts())).toMatchObject({ kind: 'allow' });
  });
  it('an admin override does not get past the age limit', () => {
    const d = decideEnrolment(
      facts({ camperDateOfBirth: '2019-07-06' }),
      opts({ actorCanOverride: true, override: { reason: 'friend of the family' } }),
    );
    expect(d).toMatchObject({ kind: 'refuse', reason: 'age_out_of_range' });
  });
  it('refuses when the date of birth is unknown, rather than guessing', () => {
    expect(decideEnrolment(facts({ camperDateOfBirth: null }), opts())).toEqual({
      kind: 'refuse',
      reason: 'age_unknown',
    });
  });
});

describe('decideEnrolment: overlap across the camp', () => {
  it('refuses and names the clashing session', () => {
    const d = decideEnrolment(facts({ camperActive: [painting] }), opts());
    expect(d).toEqual({ kind: 'refuse', reason: 'overlap', clash: painting });
  });

  it('a touching session is not a clash', () => {
    const after = { ...painting, startsAt: '2027-07-05T12:00:00Z', endsAt: '2027-07-05T14:00:00Z' };
    expect(decideEnrolment(facts({ camperActive: [after] }), opts())).toMatchObject({ kind: 'allow' });
  });

  it('an admin may override with a reason, and the override is reported for the audit log', () => {
    const d = decideEnrolment(
      facts({ camperActive: [painting] }),
      opts({ actorCanOverride: true, override: { reason: '  Parent agreed  ' } }),
    );
    expect(d).toEqual({ kind: 'allow', status: 'enrolled', overrode: { reason: 'Parent agreed', clash: painting } });
  });

  it('an override with a blank reason is refused', () => {
    const d = decideEnrolment(
      facts({ camperActive: [painting] }),
      opts({ actorCanOverride: true, override: { reason: '   ' } }),
    );
    expect(d).toEqual({ kind: 'refuse', reason: 'override_needs_reason' });
  });

  it('a staff member cannot override, even with a reason', () => {
    const d = decideEnrolment(
      facts({ camperActive: [painting] }),
      opts({ actorCanOverride: false, override: { reason: 'Parent agreed' } }),
    );
    expect(d).toEqual({ kind: 'refuse', reason: 'override_not_allowed' });
  });

  it('a staff member asking for an override is refused even when nothing clashes', () => {
    expect(decideEnrolment(facts(), opts({ override: { reason: 'x' } }))).toEqual({
      kind: 'refuse',
      reason: 'override_not_allowed',
    });
  });

  it('an admin override with nothing to override is allowed and not reported as an override', () => {
    expect(decideEnrolment(facts(), opts({ actorCanOverride: true, override: { reason: 'x' } }))).toEqual({
      kind: 'allow',
      status: 'enrolled',
      overrode: null,
    });
  });
});

describe('decideEnrolment: capacity (hard limit)', () => {
  it('takes the last seat', () => {
    expect(decideEnrolment(facts({ seatsTaken: 1 }), opts())).toEqual({
      kind: 'allow',
      status: 'enrolled',
      overrode: null,
    });
  });
  it('refuses when full', () => {
    expect(decideEnrolment(facts({ seatsTaken: 2 }), opts())).toEqual({
      kind: 'refuse',
      reason: 'session_full',
      capacity: 2,
    });
  });
  it('places a camper on the waitlist when full and the waitlist was asked for', () => {
    expect(decideEnrolment(facts({ seatsTaken: 2 }), opts({ waitlistIfFull: true }))).toEqual({
      kind: 'allow',
      status: 'waitlisted',
      overrode: null,
    });
  });
  it('the waitlist does not get past an overlap', () => {
    expect(
      decideEnrolment(facts({ seatsTaken: 2, camperActive: [painting] }), opts({ waitlistIfFull: true })),
    ).toMatchObject({ kind: 'refuse', reason: 'overlap' });
  });
});

describe('describeRefusal (the reason a person reads)', () => {
  it('names the clashing session and its time in the camp zone', () => {
    const msg = describeRefusal({ kind: 'refuse', reason: 'overlap', clash: painting }, 'UTC');
    expect(msg).toContain('Painting');
    expect(msg).toContain('11:00');
    expect(msg).toContain('13:00');
  });
  it('gives the age range and the camper age', () => {
    const msg = describeRefusal(
      { kind: 'refuse', reason: 'age_out_of_range', age: 7, range: { minAge: 8, maxAge: 12 } },
      'UTC',
    );
    expect(msg).toContain('8');
    expect(msg).toContain('12');
    expect(msg).toContain('7');
  });
  it('says the session is full and how many places it has', () => {
    expect(describeRefusal({ kind: 'refuse', reason: 'session_full', capacity: 2 }, 'UTC')).toContain('full');
  });
  it('explains a missing reason for an override', () => {
    expect(describeRefusal({ kind: 'refuse', reason: 'override_needs_reason' }, 'UTC')).toMatch(/reason/i);
  });
});
