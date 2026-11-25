import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import type { AssignInput } from '@buxa/contracts';
import { createGroupService, type GroupOutcome } from './GroupService';
import { InMemoryGroupRepository } from './InMemoryGroupRepository';

// What the service does for a screen: the rules run, a refusal comes back with its reason and its words, and a viewer is refused.
// These use the in-memory store; the same rules are checked on Postgres by the shared contract.

function setUp() {
  const repo = new InMemoryGroupRepository();
  const service = createGroupService({ repo });
  const orgId = randomUUID();
  const actor = (role: Role | 'teacher'): Actor =>
    role === 'teacher'
      ? { userId: randomUUID(), orgId, role: 'viewer', instructor: true }
      : { userId: randomUUID(), orgId, role };
  const session = repo.seedSession({ orgId, name: 'Summer 1', startsOn: '2027-07-05', endsOn: '2027-07-17' });

  return { repo, service, orgId, actor, session };
}

function expectOk<T>(outcome: GroupOutcome<T>): T {
  if (!outcome.ok) {
    throw new Error(`expected success, got ${outcome.failure.reason}: ${outcome.failure.message}`);
  }

  return outcome.value;
}

function expectFailure<T>(outcome: GroupOutcome<T>) {
  if (outcome.ok) {
    throw new Error('expected a refusal');
  }

  return outcome.failure;
}

describe('GroupService', () => {
  it('refuses a viewer any placement, with a 403', async () => {
    const { service, actor, session, repo } = setUp();
    const viewer = actor('viewer');
    const person = repo.seedPerson({ orgId: viewer.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(actor('staff'), session.id, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      }),
    );
    const room = expectOk(
      await service.createRoom(actor('staff'), session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );

    await expect(
      service.assign(viewer, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses a viewer and a teacher any unassign, with a 403', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const person = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    await expect(
      service.unassign(actor('viewer'), { sessionId: session.id, personId: person.id }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.unassign(actor('teacher'), { sessionId: session.id, personId: person.id }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.audit.some(a => a.action === 'assignment.unassign')).toBe(false);
  });

  it('unassigns a placed person, audits it with the session, person, group and room, and refuses a second unassign', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const person = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    const ended = expectOk(await service.unassign(staff, { sessionId: session.id, personId: person.id }));
    expect(ended).toMatchObject({ personId: person.id, groupId: group.id, roomId: room.id });
    expect(repo.audit.find(a => a.action === 'assignment.unassign')?.data).toEqual({
      sessionId: session.id,
      personId: person.id,
      groupId: group.id,
      roomId: room.id,
    });

    const again = expectFailure(await service.unassign(staff, { sessionId: session.id, personId: person.id }));
    expect(again.reason).toBe('not_assigned');
    expect(again.message).toMatch(/nothing to unassign/);
  });

  it('places a camper and returns the placement with the person named', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const person = repo.seedPerson({ orgId: staff.orgId, name: 'Ada Lovelace', dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: { minAge: 7, maxAge: 9 },
      }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );

    const placed = expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    expect(placed).toMatchObject({
      personName: 'Ada Lovelace',
      groupId: group.id,
      roomId: room.id,
      overrideReason: null,
    });
  });

  it('refuses a camper outside the group age range, and says the age on the first day', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const person = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2010-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: { minAge: 7, maxAge: 9 },
      }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    expect(failure.reason).toBe('age_out_of_range');
    expect(failure.message).toBe('This group is for ages 7 to 9. The camper is 17 on the first day of the session.');
    expect(failure.refusal).toBeDefined();
  });

  it('refuses a placement into a full group with the capacity in the message', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const first = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const second = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 1, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    const input = (personId: string): AssignInput => ({
      sessionId: session.id,
      personId,
      role: 'camper',
      groupId: group.id,
      roomId: room.id,
    });
    expectOk(await service.assign(staff, input(first.id)));

    const failure = expectFailure(await service.assign(staff, input(second.id)));

    expect(failure).toMatchObject({
      reason: 'group_full',
      message: 'This group is full (1 campers). Move someone out, or choose another group.',
    });
  });

  it('refuses a room used by a session that shares a day, and names that session', async () => {
    const { service, actor, repo, orgId } = setUp();
    const staff = actor('staff');
    const first = repo.seedSession({ orgId, name: 'Summer 1', startsOn: '2027-07-05', endsOn: '2027-07-17' });
    const second = repo.seedSession({ orgId, name: 'Art week', startsOn: '2027-07-10', endsOn: '2027-07-20' });
    const a = repo.seedPerson({ orgId, dateOfBirth: '2019-01-01' });
    const b = repo.seedPerson({ orgId, dateOfBirth: '2019-01-01' });
    const groupA = expectOk(
      await service.createGroup(staff, first.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const roomA = expectOk(
      await service.createRoom(staff, first.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    const groupB = expectOk(
      await service.createGroup(staff, second.id, { name: 'Owls', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const roomB = expectOk(
      await service.createRoom(staff, second.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: first.id,
        personId: a.id,
        role: 'camper',
        groupId: groupA.id,
        roomId: roomA.id,
      }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: second.id,
        personId: b.id,
        role: 'camper',
        groupId: groupB.id,
        roomId: roomB.id,
      }),
    );

    expect(failure.reason).toBe('room_overlap');
    expect(failure.message).toMatch(/in use by Summer 1 \(5 Jul 2027 to 17 Jul 2027\)/);
  });

  it('refuses a placement that breaks the staff ratio, with the counts and the way out', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const instructor = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: null, roles: ['instructor'] });
    const a = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const b = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: 1, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: instructor.id,
        role: 'staff',
        groupId: group.id,
        roomId: room.id,
      }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: a.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: session.id,
        personId: b.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    expect(failure.reason).toBe('ratio');
    expect(failure.message).toBe(
      'This group would have 2 campers for 1 staff. Its ratio is 1 staff to 1 campers. An admin can override it with a reason.',
    );
  });

  it('lets an admin override a ratio refusal, stores the reason, and audits it', async () => {
    const { service, actor, session, repo } = setUp();
    const admin = actor('admin');
    const instructor = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: null, roles: ['instructor'] });
    const a = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: '2019-01-01' });
    const b = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(admin, session.id, { name: 'Hawks', capacity: 4, ratioCampers: 1, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(admin, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(admin, {
        sessionId: session.id,
        personId: instructor.id,
        role: 'staff',
        groupId: group.id,
        roomId: room.id,
      }),
    );
    expectOk(
      await service.assign(admin, {
        sessionId: session.id,
        personId: a.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    const placed = expectOk(
      await service.assign(admin, {
        sessionId: session.id,
        personId: b.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
        override: { reason: 'Staff member on the way' },
      }),
    );

    expect(placed.overrideReason).toBe('Staff member on the way');
    expect(repo.audit.filter(e => e.action === 'assignment.override')).toHaveLength(1);
  });

  it('refuses a ratio override from someone who may not override', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const instructor = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: null, roles: ['instructor'] });
    const a = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const b = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: 1, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: instructor.id,
        role: 'staff',
        groupId: group.id,
        roomId: room.id,
      }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: a.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: session.id,
        personId: b.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
        override: { reason: 'Please' },
      }),
    );

    expect(failure.reason).toBe('override_not_allowed');
  });

  it('refuses an admin override with a blank reason', async () => {
    const { service, actor, session, repo } = setUp();
    const admin = actor('admin');
    const instructor = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: null, roles: ['instructor'] });
    const a = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: '2019-01-01' });
    const b = repo.seedPerson({ orgId: admin.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(admin, session.id, { name: 'Hawks', capacity: 4, ratioCampers: 1, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(admin, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(admin, {
        sessionId: session.id,
        personId: instructor.id,
        role: 'staff',
        groupId: group.id,
        roomId: room.id,
      }),
    );
    expectOk(
      await service.assign(admin, {
        sessionId: session.id,
        personId: a.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    const failure = expectFailure(
      await service.assign(admin, {
        sessionId: session.id,
        personId: b.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
        override: { reason: '   ' },
      }),
    );

    expect(failure.reason).toBe('override_needs_reason');
  });

  it('refuses a session with no dates yet, before any rule runs', async () => {
    const { service, actor, repo, orgId } = setUp();
    const staff = actor('staff');
    const undated = repo.seedSession({ orgId, name: 'Undated', startsOn: null, endsOn: null });
    const person = repo.seedPerson({ orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, undated.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, undated.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: undated.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    expect(failure.reason).toBe('session_undated');
  });

  it('refuses a camper who does not hold the camper role', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const adult = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: null, roles: ['guardian'] });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );

    const failure = expectFailure(
      await service.assign(staff, {
        sessionId: session.id,
        personId: adult.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    expect(failure.reason).toBe('role_missing');
  });

  it('refuses a capacity edit that would drop below the campers placed', async () => {
    const { service, actor, session, repo } = setUp();
    const staff = actor('staff');
    const person = repo.seedPerson({ orgId: staff.orgId, dateOfBirth: '2019-01-01' });
    const group = expectOk(
      await service.createGroup(staff, session.id, { name: 'Hawks', capacity: 4, ratioCampers: null, ageRange: null }),
    );
    const room = expectOk(
      await service.createRoom(staff, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 }),
    );
    expectOk(
      await service.assign(staff, {
        sessionId: session.id,
        personId: person.id,
        role: 'camper',
        groupId: group.id,
        roomId: room.id,
      }),
    );

    // The group holds one camper, so a capacity of zero is below the places already taken.
    const failure = expectFailure(
      await service.updateGroup(staff, group.id, { name: 'Hawks', capacity: 0, ratioCampers: null, ageRange: null }),
    );

    expect(failure).toMatchObject({
      reason: 'capacity_below_placed',
      message: 'The group capacity is below the campers already placed in it.',
    });
  });
});
