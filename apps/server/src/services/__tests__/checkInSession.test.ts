import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { InMemoryGroupRepository } from '../../groups/InMemoryGroupRepository';
import { createGroupService, type GroupService } from '../../groups/GroupService';
import { createCamp, thrown, type Camp } from './support';

/** Camp days: the camp clock is 10 July 2027 in UTC, so that is "today". */
const TODAY_CLOCK = '2027-07-10T12:00:00Z';

interface Setup {
  camp: Camp;
  admin: Actor;
  staff: Actor;
  viewer: Actor;
  groups: GroupService;
  /** A session in progress today. */
  current: string;
}

/** Creates a session in the class store and mirrors it into the group store, which keeps its own copy of sessions. */
async function addSession(camp: Camp, admin: Actor, name: string, startsOn: string, endsOn: string): Promise<string> {
  const session = await camp.repos.classes.createSession(admin, { name, description: '', startsOn, endsOn });
  (camp.repos.groups as InMemoryGroupRepository).seedSession({
    id: session.id,
    orgId: camp.orgId,
    name,
    startsOn,
    endsOn,
  });

  return session.id;
}

/** A camp with one session in progress today, and staff who can check campers in. */
async function setup(): Promise<Setup> {
  const camp = await createCamp('UTC', TODAY_CLOCK);
  const admin = camp.actor('admin');
  const current = await addSession(camp, admin, 'Summer one', '2027-07-01', '2027-07-31');

  return {
    camp,
    admin,
    staff: camp.actor('staff'),
    viewer: camp.actor('viewer'),
    groups: createGroupService({ repo: camp.repos.groups }),
    current,
  };
}

/** A camper with a valid membership, known to the group store too (so a placement can name them). */
async function camper(s: Setup, givenName: string): Promise<string> {
  // A participant needs no guardian household, so the test can check a person in without one.
  const person = await s.camp.people.create(s.admin, {
    dateOfBirth: '1985-06-15',
    phone: '+1 555 0100',
    givenName,
    familyName: 'Test',
    roles: ['participant'],
  });
  await s.camp.memberships.add(s.admin, {
    personId: person.id,
    plan: 'Summer',
    startsOn: '2027-07-01',
    endsOn: '2027-08-31',
  });
  (s.camp.repos.groups as InMemoryGroupRepository).seedPerson({ id: person.id, orgId: s.camp.orgId, name: givenName });

  return person.id;
}

/** Places a camper in a group and room for the session, as the Assign page does. */
async function placeInSession(s: Setup, sessionId: string, personId: string): Promise<void> {
  const group = await s.groups.createGroup(s.admin, sessionId, {
    name: `Group ${personId.slice(0, 4)}`,
    capacity: 10,
    ratioCampers: null,
    ageRange: null,
  });
  const room = await s.groups.createRoom(s.admin, sessionId, {
    name: `Room ${personId.slice(0, 4)}`,
    location: 'Main site',
    capacity: 10,
  });
  if (!group.ok || !room.ok) {
    throw new Error('expected a group and a room');
  }
  const placed = await s.groups.assign(s.admin, {
    sessionId,
    personId,
    role: 'camper',
    groupId: group.value.id,
    roomId: room.value.id,
  });
  if (!placed.ok) {
    throw new Error('expected a placement');
  }
}

describe('per-session check-in: the session and the unassigned flag', () => {
  it('records the session with no flag for a camper assigned to it', async () => {
    const s = await setup();
    const kim = await camper(s, 'Kim');
    await placeInSession(s, s.current, kim);

    const result = await s.camp.attendance.checkIn(s.staff, { personId: kim, method: 'qr', sessionId: s.current });

    expect(result).toMatchObject({ ok: true, unassigned: false });
    const visit = await s.camp.repos.attendance.openFor(s.staff.userId, s.camp.orgId, kim);
    expect(visit).toMatchObject({ sessionId: s.current, sessionUnassigned: false });
  });

  it('checks in an unassigned camper, flags the record and the audit entry, and still succeeds', async () => {
    const s = await setup();
    const ben = await camper(s, 'Ben');

    const result = await s.camp.attendance.checkIn(s.staff, { personId: ben, method: 'manual', sessionId: s.current });

    expect(result).toMatchObject({ ok: true, unassigned: true });
    const visit = await s.camp.repos.attendance.openFor(s.staff.userId, s.camp.orgId, ben);
    expect(visit).toMatchObject({ sessionId: s.current, sessionUnassigned: true });
    const audit = s.camp.audit().find(a => a.action === 'attendance.check_in' && a.entityId === visit?.id);
    expect(audit?.data).toMatchObject({ sessionId: s.current, sessionUnassigned: true });
  });

  it('keeps a camp without sessions unchanged: a camp-day check-in with no session and no flag', async () => {
    const camp = await createCamp('UTC', TODAY_CLOCK);
    const staff = camp.actor('staff');
    const person = await camp.people.create(camp.actor('admin'), {
      dateOfBirth: '1985-06-15',
      phone: '+1 555 0100',
      givenName: 'Ada',
      familyName: 'Plain',
      roles: ['participant'],
    });
    await camp.memberships.add(camp.actor('admin'), {
      personId: person.id,
      plan: 'Summer',
      startsOn: '2027-07-01',
      endsOn: '2027-08-31',
    });

    const result = await camp.attendance.checkIn(staff, { personId: person.id, method: 'qr' });

    expect(result).toMatchObject({ ok: true, unassigned: false });
    const visit = await camp.repos.attendance.openFor(staff.userId, camp.orgId, person.id);
    expect(visit).toMatchObject({ sessionId: null, sessionUnassigned: false });
  });

  it('asks for a session when the camp has one in progress today, and refuses a session that is not the camp', async () => {
    const s = await setup();
    const kim = await camper(s, 'Kim');

    expect((await thrown(() => s.camp.attendance.checkIn(s.staff, { personId: kim, method: 'qr' }))).statusCode).toBe(
      400,
    );
    const other = await thrown(() =>
      s.camp.attendance.checkIn(s.staff, {
        personId: kim,
        method: 'qr',
        sessionId: '00000000-0000-4000-8000-000000000999',
      }),
    );
    expect(other.statusCode).toBe(400);
  });

  it('refuses a viewer a check-in, with or without a session (403)', async () => {
    const s = await setup();
    const kim = await camper(s, 'Kim');

    expect(
      (await thrown(() => s.camp.attendance.checkIn(s.viewer, { personId: kim, method: 'qr', sessionId: s.current })))
        .statusCode,
    ).toBe(403);
    expect((await thrown(() => s.camp.attendance.checkInSessions(s.viewer))).statusCode).toBe(403);
  });
});

describe('per-session check-in: the session choice', () => {
  it('lists only the sessions in progress or starting today, in camp time', async () => {
    const s = await setup();
    await addSession(s.camp, s.admin, 'Last June', '2027-06-01', '2027-06-30');
    await addSession(s.camp, s.admin, 'Starts today', '2027-07-10', '2027-07-20');
    await addSession(s.camp, s.admin, 'August', '2027-08-01', '2027-08-31');

    const offered = await s.camp.attendance.checkInSessions(s.staff);

    expect(offered.map(o => o.name).sort()).toEqual(['Starts today', 'Summer one']);
  });

  it('offers nothing for a camp whose sessions are all in the past or the future', async () => {
    const camp = await createCamp('UTC', TODAY_CLOCK);
    const admin = camp.actor('admin');
    await camp.repos.classes.createSession(admin, {
      name: 'Last June',
      description: '',
      startsOn: '2027-06-01',
      endsOn: '2027-06-30',
    });

    expect(await camp.attendance.checkInSessions(camp.actor('staff'))).toEqual([]);
  });
});
