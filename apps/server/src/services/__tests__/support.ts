import type { Actor, Role } from '@buxa/domain';
import type { Clock } from '../clock';

/** A test's role: an access level, or `teacher`, which is a viewer whose person is an instructor (the teaching view). */
export type TestRole = Role | 'teacher';
/** The access level a test role is stored with. `teacher` is a viewer (migration 0069); the instructor flag is set separately. */
export const accessOf = (role: TestRole): Role => (role === 'teacher' ? 'viewer' : role);
import { InMemoryStore } from '../../__tests__/fakes';
import type { Repositories } from '../../repositories';
import { createAttendanceService } from '../attendance/createAttendanceService';
import { createCredentialService } from '../credentials/createCredentialService';
import { createBadgeCipher, parseBadgeKey } from '../../credentials/badgeCipher';

/** A fixed test key (32 bytes, base64). Never a real key. */
export const TEST_BADGE_KEY = Buffer.alloc(32, 3).toString('base64');
import { createMembershipService } from '../memberships/createMembershipService';
import { createPeopleService } from '../people/createPeopleService';
import type { InMemoryClassRepository } from '../../classes/InMemoryClassRepository';

/**
 * A camp built on the in-memory adapters, with every real service wired the way `createServices` wires them, and a clock the test
 * moves by hand. One org, one owner, and one signed-in user per role so each actor has a real membership row.
 */
export interface Camp {
  repos: Repositories;
  store: InMemoryStore;
  orgId: string;
  people: ReturnType<typeof createPeopleService>;
  memberships: ReturnType<typeof createMembershipService>;
  credentials: ReturnType<typeof createCredentialService>;
  attendance: ReturnType<typeof createAttendanceService>;
  /** Moves the clock to `iso`. */
  at(iso: string): void;
  /** A signed-in actor with the given role, already a member of this camp. */
  actor(role: TestRole): Actor;
  /** The audit log, oldest first. */
  audit(): InMemoryStore['audit'];
}

export async function createCamp(timeZone = 'UTC', start = '2027-07-10T12:00:00Z'): Promise<Camp> {
  const store = new InMemoryStore();
  const repos = store.asRepositories();
  let now = new Date(start);
  const clock: Clock = () => new Date(now.getTime());

  const owner = await store.upsertFromIdentity({ authId: 'owner', email: 'owner@example.org', name: 'Olive Owner' });
  const org = await store.createWithOwner({ name: 'Summer Camp', slug: 'summer-camp', timezone: timeZone }, owner.id);
  const users = new Map<TestRole, string>([['owner', owner.id]]);
  for (const role of ['admin', 'staff', 'viewer', 'teacher'] as const) {
    const user = await store.upsertFromIdentity({
      authId: `${role}-user`,
      email: `${role}@example.org`,
      name: `${role[0].toUpperCase()}${role.slice(1)} User`,
    });
    store.members.push({ orgId: org.id, userId: user.id, role: accessOf(role) });
    users.set(role, user.id);
    if (role === 'teacher') {
      // An instructor: viewer access plus the instructor person role (migration 0069). The in-memory class store keeps the
      // teacher for the scope check (Postgres reads the person's classes).
      store.instructors.add(`${org.id}:${user.id}`);
      (repos.classes as InMemoryClassRepository).seedTeacher(org.id, user.id);
    }
  }

  return {
    repos,
    store,
    orgId: org.id,
    people: createPeopleService({
      people: repos.people,
      memberships: repos.memberships,
      credentials: repos.credentials,
      attendance: repos.attendance,
      classes: repos.classes,
      orgs: repos.orgs,
      clock,
    }),
    memberships: createMembershipService({
      memberships: repos.memberships,
      people: repos.people,
      classes: repos.classes,
      orgs: repos.orgs,
      clock,
    }),
    credentials: createCredentialService({
      credentials: repos.credentials,
      people: repos.people,
      memberships: repos.memberships,
      attendance: repos.attendance,
      orgs: repos.orgs,
      clock,
      cipher: createBadgeCipher(() => parseBadgeKey(TEST_BADGE_KEY)),
    }),
    attendance: createAttendanceService({
      attendance: repos.attendance,
      classes: repos.classes,
      groups: repos.groups,
      people: repos.people,
      memberships: repos.memberships,
      orgs: repos.orgs,
      clock,
    }),
    at(iso) {
      now = new Date(iso);
    },
    actor(role) {
      const userId = users.get(role);
      if (!userId) {
        throw new Error(`no ${role} user`);
      }

      return role === 'teacher'
        ? { userId, orgId: org.id, role: 'viewer', instructor: true }
        : { userId, orgId: org.id, role: accessOf(role) };
    },
    audit: () => store.audit,
  };
}

/** Runs `work` and returns the error it threw, or fails the test if it did not throw. */
export async function thrown(work: () => Promise<unknown>): Promise<{ statusCode?: number; message: string }> {
  try {
    await work();
  } catch (error) {
    if (error instanceof Error) {
      return { statusCode: (error as { statusCode?: number }).statusCode, message: error.message };
    }
    throw error;
  }
  throw new Error('expected an error, none was thrown');
}

/**
 * Test setup for the teacher link (migration 0051): a roster person for the teacher's login, linked to that login. The returned
 * person id goes in a class's instructorIds, and a teacher sees the classes that name its linked person as an instructor.
 */
export async function linkTeacher(camp: Camp, teacherUserId: string): Promise<string> {
  const person = await camp.people.create(camp.actor('admin'), {
    givenName: 'Tess',
    familyName: 'Teacher',
    roles: ['instructor'],
  });
  const store = camp.repos.classes as InMemoryClassRepository;
  store.seedCamper(camp.orgId, person.id, 'Tess Teacher', null);
  store.linkPersonToLogin(person.id, teacherUserId);

  return person.id;
}
