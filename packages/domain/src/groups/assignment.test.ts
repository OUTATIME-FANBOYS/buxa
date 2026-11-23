import { describe, expect, it } from 'vitest';
import {
  decideAssignment,
  ratioHolds,
  type AssignmentDecision,
  type AssignmentFacts,
  type AssignmentOptions,
} from './assignment';
import { daySpan, formatDay } from './days';
import { describeAssignmentRefusal } from './refusals';

// A session from Monday 5 July 2027 to Saturday 17 July 2027 (both days included).
const SESSION = { startsOn: '2027-07-05', endsOn: '2027-07-17' };

function facts(over: Partial<AssignmentFacts> = {}): AssignmentFacts {
  return {
    session: SESSION,
    person: { role: 'camper', dateOfBirth: '2018-03-01', holdsRole: true },
    group: { capacity: 4, campers: 1, staff: 1, ratioCampers: 4, ageRange: { minAge: 8, maxAge: 12 } },
    room: { capacity: 10, campers: 0 },
    roomUses: [],
    ...over,
  };
}

const NO_OVERRIDE: AssignmentOptions = { override: null, actorCanOverride: false };
const ADMIN: AssignmentOptions = { override: null, actorCanOverride: true };

/** The words for a refusal; fails the test when the decision is not a refusal. */
function refusalText(d: AssignmentDecision): string {
  if (d.kind !== 'refuse') {
    throw new Error('expected a refusal');
  }

  return describeAssignmentRefusal(d);
}

describe('group capacity', () => {
  it('allows a camper into the last place', () => {
    expect(decideAssignment(facts({ group: { ...facts().group, campers: 3 } }), NO_OVERRIDE)).toEqual({
      kind: 'allow',
      overrode: null,
    });
  });

  it('refuses a camper when the group is at its limit', () => {
    const d = decideAssignment(facts({ group: { ...facts().group, campers: 4 } }), NO_OVERRIDE);
    expect(d).toEqual({ kind: 'refuse', reason: 'group_full', capacity: 4 });
    expect(refusalText(d)).toMatch(/full \(4 campers\)/);
  });

  it('does not count staff toward capacity', () => {
    const d = decideAssignment(
      facts({ person: { role: 'staff', dateOfBirth: null, holdsRole: true }, group: { ...facts().group, campers: 4 } }),
      NO_OVERRIDE,
    );
    expect(d).toEqual({ kind: 'allow', overrode: null });
  });
});

describe('age range', () => {
  it('refuses a camper outside the range, with the age on the first day of the session', () => {
    const d = decideAssignment(
      facts({ person: { role: 'camper', dateOfBirth: '2010-01-01', holdsRole: true } }),
      NO_OVERRIDE,
    );
    expect(d).toMatchObject({ kind: 'refuse', reason: 'age_out_of_range', age: 17 });
  });

  it('takes the age on the first day, not on the last', () => {
    // Born 5 July 2019: 8 on the first day (5 July 2027), so inside 8 to 12.
    const d = decideAssignment(
      facts({ person: { role: 'camper', dateOfBirth: '2019-07-05', holdsRole: true } }),
      NO_OVERRIDE,
    );
    expect(d).toEqual({ kind: 'allow', overrode: null });
  });

  it('refuses a camper with no date of birth when the group has an age range', () => {
    const d = decideAssignment(facts({ person: { role: 'camper', dateOfBirth: null, holdsRole: true } }), NO_OVERRIDE);
    expect(d).toEqual({ kind: 'refuse', reason: 'age_unknown' });
  });

  it('skips the age check for a group with no range', () => {
    const d = decideAssignment(
      facts({
        person: { role: 'camper', dateOfBirth: null, holdsRole: true },
        group: { ...facts().group, ageRange: null },
      }),
      NO_OVERRIDE,
    );
    expect(d).toEqual({ kind: 'allow', overrode: null });
  });
});

describe('staff ratio', () => {
  it('allows campers up to the ratio and refuses one more', () => {
    expect(ratioHolds(4, 1, 4)).toBe(true);
    expect(ratioHolds(5, 1, 4)).toBe(false);
    expect(ratioHolds(1, 0, 4)).toBe(false);
    expect(ratioHolds(9, 0, null)).toBe(true);
  });

  it('refuses a camper that breaks the ratio, with the counts', () => {
    const d = decideAssignment(facts({ group: { ...facts().group, campers: 4, capacity: 10 } }), NO_OVERRIDE);
    expect(d).toEqual({ kind: 'refuse', reason: 'ratio', campers: 5, staff: 1, ratioCampers: 4 });
  });

  it('lets an admin override a ratio refusal with a reason, and reports it', () => {
    const d = decideAssignment(facts({ group: { ...facts().group, campers: 4, capacity: 10 } }), {
      override: { reason: '  Staff on the way  ' },
      actorCanOverride: true,
    });
    expect(d).toEqual({
      kind: 'allow',
      overrode: { reason: 'Staff on the way', campers: 5, staff: 1, ratioCampers: 4 },
    });
  });

  it('refuses an override with no reason', () => {
    const d = decideAssignment(facts({ group: { ...facts().group, campers: 4, capacity: 10 } }), {
      override: { reason: '   ' },
      actorCanOverride: true,
    });
    expect(d).toEqual({ kind: 'refuse', reason: 'override_needs_reason' });
  });

  it('refuses an override from someone who may not override', () => {
    const d = decideAssignment(facts({ group: { ...facts().group, campers: 4, capacity: 10 } }), {
      override: { reason: 'Please' },
      actorCanOverride: false,
    });
    expect(d).toEqual({ kind: 'refuse', reason: 'override_not_allowed' });
  });

  it('records no override when the ratio already holds', () => {
    expect(decideAssignment(facts(), ADMIN)).toEqual({ kind: 'allow', overrode: null });
  });

  it('does not refuse a staff member for the ratio', () => {
    const d = decideAssignment(
      facts({
        person: { role: 'staff', dateOfBirth: null, holdsRole: true },
        group: { ...facts().group, campers: 8, capacity: 10 },
      }),
      NO_OVERRIDE,
    );
    expect(d).toEqual({ kind: 'allow', overrode: null });
  });
});

describe('room overlap', () => {
  // "Painting" runs 10 to 20 July, so it shares the days 10 to 17 with the session.
  const other = { sessionId: 'other', label: 'Painting', startsOn: '2027-07-10', endsOn: '2027-07-20' };

  it('refuses a room used by a session that shares a day', () => {
    const d = decideAssignment(facts({ roomUses: [other] }), NO_OVERRIDE);
    expect(d).toEqual({ kind: 'refuse', reason: 'room_overlap', clash: other });
    expect(refusalText(d)).toMatch(/in use by Painting \(10 Jul 2027 to 20 Jul 2027\)/);
  });

  it('allows a room whose other session only touches this one (the next day)', () => {
    const touching = { ...other, startsOn: '2027-07-18', endsOn: '2027-07-30' };
    expect(decideAssignment(facts({ roomUses: [touching] }), NO_OVERRIDE)).toEqual({ kind: 'allow', overrode: null });
  });

  it('refuses a session that shares only its last day', () => {
    const lastDay = { ...other, startsOn: '2027-07-17', endsOn: '2027-07-30' };
    expect(decideAssignment(facts({ roomUses: [lastDay] }), NO_OVERRIDE)).toMatchObject({ reason: 'room_overlap' });
  });

  it('does not let an admin override a room clash', () => {
    expect(decideAssignment(facts({ roomUses: [other] }), ADMIN)).toMatchObject({ reason: 'room_overlap' });
  });

  it('refuses a room that is full for this session', () => {
    const d = decideAssignment(facts({ room: { capacity: 2, campers: 2 } }), NO_OVERRIDE);
    expect(d).toEqual({ kind: 'refuse', reason: 'room_full', capacity: 2 });
  });

  it('day spans run from the first day through the last, inclusive', () => {
    expect(daySpan('2027-07-05', '2027-07-05')).toEqual({
      startsAt: '2027-07-05T00:00:00.000Z',
      endsAt: '2027-07-06T00:00:00.000Z',
    });
    expect(formatDay('2027-07-05')).toBe('5 Jul 2027');
  });
});

describe('roles', () => {
  it('refuses a person who does not hold the role being placed', () => {
    const d = decideAssignment(
      facts({ person: { role: 'camper', dateOfBirth: '2018-03-01', holdsRole: false } }),
      NO_OVERRIDE,
    );
    expect(d).toEqual({ kind: 'refuse', reason: 'role_missing', role: 'camper' });
  });
});
