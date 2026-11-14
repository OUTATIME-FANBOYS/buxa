import type { Actor, Role } from '@buxa/domain';
import type { Clock } from '../clock';
import { InMemoryStore } from '../../__tests__/fakes';
import type { Repositories } from '../../repositories';
import { createAttendanceService } from '../attendance';
import { createCredentialService } from '../credentials';
import { createMembershipService } from '../memberships';
import { createPeopleService } from '../people';

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
  actor(role: Role): Actor;
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
  const users = new Map<Role, string>([['owner', owner.id]]);
  for (const role of ['admin', 'staff', 'viewer'] as const) {
    const user = await store.upsertFromIdentity({ authId: `${role}-user`, email: `${role}@example.org`, name: `${role[0].toUpperCase()}${role.slice(1)} User` });
    store.members.push({ orgId: org.id, userId: user.id, role });
    users.set(role, user.id);
  }

  return {
    repos,
    store,
    orgId: org.id,
    people: createPeopleService({ people: repos.people, memberships: repos.memberships, credentials: repos.credentials, attendance: repos.attendance, orgs: repos.orgs, clock }),
    memberships: createMembershipService({ memberships: repos.memberships, people: repos.people, orgs: repos.orgs, clock }),
    credentials: createCredentialService({ credentials: repos.credentials, people: repos.people, memberships: repos.memberships, attendance: repos.attendance, orgs: repos.orgs, clock }),
    attendance: createAttendanceService({ attendance: repos.attendance, people: repos.people, memberships: repos.memberships, orgs: repos.orgs, clock }),
    at(iso) { now = new Date(iso); },
    actor(role) {
      const userId = users.get(role);
      if (!userId) throw new Error(`no ${role} user`);
      return { userId, orgId: org.id, role };
    },
    audit: () => store.audit,
  };
}

/** Runs `work` and returns the error it threw, or fails the test if it did not throw. */
export async function thrown(work: () => Promise<unknown>): Promise<{ statusCode?: number; message: string }> {
  try { await work(); } catch (error) {
    if (error instanceof Error) return { statusCode: (error as { statusCode?: number }).statusCode, message: error.message };
    throw error;
  }
  throw new Error('expected an error, none was thrown');
}
