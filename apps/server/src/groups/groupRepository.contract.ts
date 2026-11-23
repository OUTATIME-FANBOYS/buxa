import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decideAssignment, type Actor, type AssignmentOptions } from '@buxa/domain';
import type { AssignmentRule, AssignRequest, GroupRepository } from './GroupRepository';
import { AssignmentRefusedError, NameTakenError, PersonNotFoundError } from './errors';

/** What a contract run needs from an adapter: its repository, an owner actor, and ways to seed a session and a person. */
export interface GroupFixture {
  repo: GroupRepository;
  actor: Actor;
  /** A session in the camp, with its first and last camp days. */
  session(startsOn: string, endsOn: string): Promise<string>;
  /** A person in the camp with these camp roles, and this date of birth (null leaves it unknown). */
  person(options: { dateOfBirth: string | null; roles?: string[] }): Promise<string>;
  close(): Promise<void>;
}

const NO_OVERRIDE: AssignmentOptions = { override: null, actorCanOverride: false };

/** The domain rule, bound the way the service binds it (no override, a staff actor). */
const rule: AssignmentRule = facts => decideAssignment(facts, NO_OVERRIDE);

/**
 * One contract for every GroupRepository adapter. The in-memory adapter and the Postgres adapter both run these tests, so a rule
 * that holds in one holds in the other.
 */
export function groupRepositoryContract(factory: () => Promise<GroupFixture>): void {
  describe('GroupRepository contract', () => {
    let fx: GroupFixture;
    beforeEach(async () => {
      fx = await factory();
    });
    afterEach(async () => {
      await fx.close();
    });

    const request = (
      over: Partial<AssignRequest> & Pick<AssignRequest, 'sessionId' | 'personId' | 'groupId' | 'roomId'>,
    ): AssignRequest => ({
      role: 'camper',
      ...over,
    });

    it('creates a group and lists it with no one in it', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const group = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: 4,
        ageRange: { minAge: 8, maxAge: 12 },
      });

      expect(group).toMatchObject({ name: 'Hawks', capacity: 4, ratioCampers: 4, campers: 0, staff: 0 });
      expect(await fx.repo.listGroups(fx.actor.userId, fx.actor.orgId, sessionId)).toEqual([group]);
    });

    it('refuses a second group with the same name in one session, ignoring case', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });

      await expect(
        fx.repo.createGroup(fx.actor, sessionId, { name: 'hawks', capacity: 2, ratioCampers: null, ageRange: null }),
      ).rejects.toBeInstanceOf(NameTakenError);
    });

    it('places a camper, then moves the same camper without a second placement', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const personId = await fx.person({ dateOfBirth: '2019-01-01' });
      const hawks = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const owls = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Owls',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const room = await fx.repo.createRoom(fx.actor, sessionId, { name: 'Lodge 1', location: 'North', capacity: 10 });

      const first = await fx.repo.assign(
        fx.actor,
        request({ sessionId, personId, groupId: hawks.id, roomId: room.id }),
        rule,
      );
      const moved = await fx.repo.assign(
        fx.actor,
        request({ sessionId, personId, groupId: owls.id, roomId: room.id }),
        rule,
      );

      expect(moved.id).toBe(first.id);
      expect(moved.groupId).toBe(owls.id);
      const all = await fx.repo.listAssignments(fx.actor.userId, fx.actor.orgId, sessionId);
      expect(all).toHaveLength(1);
      expect((await fx.repo.listGroups(fx.actor.userId, fx.actor.orgId, sessionId)).map(g => g.campers)).toEqual([
        0, 1,
      ]);
    });

    it('refuses a placement that breaks capacity, and writes nothing', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const room = await fx.repo.createRoom(fx.actor, sessionId, { name: 'Lodge 1', location: 'North', capacity: 10 });
      const group = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 1,
        ratioCampers: null,
        ageRange: null,
      });
      const first = await fx.person({ dateOfBirth: '2019-01-01' });
      const second = await fx.person({ dateOfBirth: '2019-01-01' });
      await fx.repo.assign(fx.actor, request({ sessionId, personId: first, groupId: group.id, roomId: room.id }), rule);

      await expect(
        fx.repo.assign(fx.actor, request({ sessionId, personId: second, groupId: group.id, roomId: room.id }), rule),
      ).rejects.toBeInstanceOf(AssignmentRefusedError);
      expect(await fx.repo.listAssignments(fx.actor.userId, fx.actor.orgId, sessionId)).toHaveLength(1);
    });

    it('two parallel placements into the last place of a group: one succeeds, the other is refused for capacity', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const room = await fx.repo.createRoom(fx.actor, sessionId, { name: 'Lodge 1', location: 'North', capacity: 10 });
      const group = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 1,
        ratioCampers: null,
        ageRange: null,
      });
      const a = await fx.person({ dateOfBirth: '2019-01-01' });
      const b = await fx.person({ dateOfBirth: '2019-01-01' });

      const results = await Promise.allSettled([
        fx.repo.assign(fx.actor, request({ sessionId, personId: a, groupId: group.id, roomId: room.id }), rule),
        fx.repo.assign(fx.actor, request({ sessionId, personId: b, groupId: group.id, roomId: room.id }), rule),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(AssignmentRefusedError);
      expect(await fx.repo.listAssignments(fx.actor.userId, fx.actor.orgId, sessionId)).toHaveLength(1);
    });

    it('stores a ratio override with its reason on the assignment', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const room = await fx.repo.createRoom(fx.actor, sessionId, { name: 'Lodge 1', location: 'North', capacity: 10 });
      const group = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: 1,
        ageRange: null,
      });
      const staff = await fx.person({ dateOfBirth: null, roles: ['instructor'] });
      const a = await fx.person({ dateOfBirth: '2019-01-01' });
      const b = await fx.person({ dateOfBirth: '2019-01-01' });
      await fx.repo.assign(
        fx.actor,
        request({ sessionId, personId: staff, role: 'staff', groupId: group.id, roomId: room.id }),
        rule,
      );
      await fx.repo.assign(fx.actor, request({ sessionId, personId: a, groupId: group.id, roomId: room.id }), rule);

      // One staff member for one camper: a second camper breaks the 1:1 ratio, so only an override places them.
      await expect(
        fx.repo.assign(fx.actor, request({ sessionId, personId: b, groupId: group.id, roomId: room.id }), rule),
      ).rejects.toBeInstanceOf(AssignmentRefusedError);
      const overriding: AssignmentRule = facts =>
        decideAssignment(facts, { override: { reason: 'Staff on the way' }, actorCanOverride: true });
      const placed = await fx.repo.assign(
        fx.actor,
        request({ sessionId, personId: b, groupId: group.id, roomId: room.id }),
        overriding,
      );

      expect(placed.overrideReason).toBe('Staff on the way');
    });

    it('refuses a camper who clashes in room use with a session that shares a day', async () => {
      const first = await fx.session('2027-07-05', '2027-07-17');
      const second = await fx.session('2027-07-15', '2027-07-30');
      const roomA = await fx.repo.createRoom(fx.actor, first, { name: 'Lodge 1', location: 'North', capacity: 10 });
      const roomB = await fx.repo.createRoom(fx.actor, second, { name: 'lodge 1', location: 'north', capacity: 10 });
      const groupA = await fx.repo.createGroup(fx.actor, first, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const groupB = await fx.repo.createGroup(fx.actor, second, {
        name: 'Owls',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const a = await fx.person({ dateOfBirth: '2019-01-01' });
      const b = await fx.person({ dateOfBirth: '2019-01-01' });
      await fx.repo.assign(
        fx.actor,
        request({ sessionId: first, personId: a, groupId: groupA.id, roomId: roomA.id }),
        rule,
      );

      await expect(
        fx.repo.assign(
          fx.actor,
          request({ sessionId: second, personId: b, groupId: groupB.id, roomId: roomB.id }),
          rule,
        ),
      ).rejects.toBeInstanceOf(AssignmentRefusedError);
    });

    it('refuses a person who is not in the camp', async () => {
      const sessionId = await fx.session('2027-07-05', '2027-07-17');
      const room = await fx.repo.createRoom(fx.actor, sessionId, { name: 'Lodge 1', location: 'North', capacity: 10 });
      const group = await fx.repo.createGroup(fx.actor, sessionId, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });

      await expect(
        fx.repo.assign(
          fx.actor,
          request({ sessionId, personId: '00000000-0000-4000-8000-000000000000', groupId: group.id, roomId: room.id }),
          rule,
        ),
      ).rejects.toBeInstanceOf(PersonNotFoundError);
    });
  });
}
