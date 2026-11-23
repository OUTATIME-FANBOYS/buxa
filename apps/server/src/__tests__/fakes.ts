import { randomUUID } from 'node:crypto';
import type {
  ClockFormat,
  CreatedOrg,
  Member,
  Membership,
  NewOrgInput,
  Org,
  OrgPatchInput,
  OrgSummary,
  User,
} from '@buxa/contracts';
import { DEFAULT_CLOCK_FORMAT, MEMBER_OPTIONS, type Actor, type MemberOption, type Role } from '@buxa/domain';
import type { Identity } from '../auth/identity';
import { InMemoryAttendanceRepository } from '../attendance/InMemoryAttendanceRepository';
import { conflict } from '../http/errors';
import { InMemoryClassRepository } from '../classes/InMemoryClassRepository';
import type { SeatHoldRepository } from '../holds/SeatHoldRepository';
import { InMemoryImportRepository } from '../classes/import/InMemoryImportRepository';
import { InMemoryRegistrationRepository } from '../registration/InMemoryRegistrationRepository';
import { InMemoryCalendarRepository } from '../calendar/InMemoryCalendarRepository';
import { InMemoryMemberInviteRepository } from '../invites/InMemoryMemberInviteRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { InMemoryMembershipRepository } from '../memberships/InMemoryMembershipRepository';
import { OrgNotFoundError, SlugTakenError, type ArchivedCampRecord, type OrgRepository } from '../orgs/OrgRepository';
import { InMemoryPeopleRepository } from '../people/InMemoryPeopleRepository';
import { InMemoryDatabase, type AuditRecord } from '../people/InMemoryDatabase';
import type { Repositories } from '../repositories';
import { EmailInUseError, type UserRepository } from '../users/UserRepository';

/** The first word of a full name is the first name, the rest the last name (migration 0017 does the same in SQL). */
function splitName(name: string): { firstName: string; lastName: string | null } {
  const trimmed = name.trim();
  const firstName = trimmed.split(/\s+/)[0] ?? '';

  return { firstName, lastName: trimmed.slice(firstName.length).trim() || null };
}

/** A membership is live unless its team access has an expiry in the past (migration 0043 says the same in SQL). */
function isLive(member: { expiresAt?: string | null }): boolean {
  return !member.expiresAt || new Date(member.expiresAt).getTime() > Date.now();
}

/** The User the repository returns: the stored fields, without the auth id. */
function publicUser(u: {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string | null;
  clockFormat: ClockFormat | null;
}): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    clockFormat: u.clockFormat,
  };
}

interface StoredOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  timezone: string;
  clockFormat: ClockFormat;
  archivedAt: string | null;
}

/**
 * An in-memory stand-in for Postgres: users and organisations here, and the people, membership, badge and attendance adapters
 * sharing one InMemoryDatabase. It is the second adapter that makes the repository interfaces a real seam.
 */
export class InMemoryStore implements UserRepository, OrgRepository {
  readonly users = new Map<string, User & { authId: string }>();
  readonly orgs = new Map<string, StoredOrg>();
  /** `expiresAt` is the team access end (migration 0043); absent or null means no expiry. */
  readonly members: { orgId: string; userId: string; role: Role; expiresAt?: string | null }[] = [];
  /** Public so a test can read the people and badges a camp holds (the fake of the Postgres tables). */
  readonly database = new InMemoryDatabase();

  /** Every audit row written through this store's adapters, oldest first. */
  get audit(): readonly AuditRecord[] {
    return this.database.audit;
  }

  upsertFromIdentity(identity: Identity): Promise<User> {
    const existing = [...this.users.values()].find(u => u.authId === identity.authId);
    if (existing) {
      return Promise.resolve(publicUser(existing));
    }
    if ([...this.users.values()].some(u => u.email === identity.email)) {
      return Promise.reject(new EmailInUseError());
    }
    const user = {
      ...splitName(identity.name),
      id: randomUUID(),
      authId: identity.authId,
      email: identity.email,
      name: identity.name,
      clockFormat: null,
    };
    this.users.set(user.id, user);

    return Promise.resolve(publicUser(user));
  }
  updateName(userId: string, name: { firstName: string; lastName: string | null }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      return Promise.reject(new Error('no user to rename'));
    }
    Object.assign(user, {
      firstName: name.firstName,
      lastName: name.lastName,
      name: [name.firstName, name.lastName].filter(Boolean).join(' '),
    });

    return Promise.resolve(publicUser(user));
  }
  setClockFormat(userId: string, clockFormat: ClockFormat): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      return Promise.reject(new Error('no user to update'));
    }
    user.clockFormat = clockFormat;

    return Promise.resolve(publicUser(user));
  }
  roleIn(_signedIn: string, orgId: string, userId: string): Promise<Membership['role'] | null> {
    const member = this.members.find(m => m.orgId === orgId && m.userId === userId && isLive(m));

    return Promise.resolve(member?.role ?? null);
  }
  renameMember(actor: Actor, userId: string, name: string): Promise<Pick<User, 'id' | 'email' | 'name'> | null> {
    const user = this.users.get(userId);
    const inCamp = this.members.some(m => m.orgId === actor.orgId && m.userId === userId);
    if (!user || !inCamp) {
      return Promise.resolve(null);
    }
    Object.assign(user, splitName(name));
    user.name = name;
    this.database.record(actor, 'member.rename', 'user', userId, { name });

    return Promise.resolve({ id: user.id, email: user.email, name: user.name });
  }
  /** Options that are on, as `${orgId}:${userId}:${option}`. */
  readonly memberOptions = new Set<string>();
  memberOptionsOf(_viewerId: string, orgId: string, userId: string): Promise<MemberOption[]> {
    return Promise.resolve(MEMBER_OPTIONS.filter(o => this.memberOptions.has(`${orgId}:${userId}:${o}`)));
  }
  memberOptionsIn(_viewerId: string, orgId: string): Promise<{ userId: string; option: MemberOption }[]> {
    return Promise.resolve(
      [...this.memberOptions]
        .filter(k => k.startsWith(`${orgId}:`))
        .map(k => {
          const [, userId, option] = k.split(':');

          return { userId, option: option as MemberOption };
        }),
    );
  }
  setMemberOption(actor: Actor, userId: string, option: MemberOption, enabled: boolean): Promise<void> {
    const role = this.members.find(m => m.orgId === actor.orgId && m.userId === userId)?.role;
    if (role !== 'teacher') {
      return Promise.reject(new Error('Teacher not found'));
    }
    const key = `${actor.orgId}:${userId}:${option}`;
    if (enabled) {
      this.memberOptions.add(key);
    } else {
      this.memberOptions.delete(key);
    }
    this.database.record(actor, 'member.option_set', 'user', userId, { option, enabled });

    return Promise.resolve();
  }

  membershipsOf(userId: string): Promise<Membership[]> {
    const rows = this.members.flatMap(m => {
      const o = this.orgs.get(m.orgId);
      if (m.userId !== userId || !o || o.archivedAt || !isLive(m)) {
        return [];
      }

      return [{ orgId: o.id, role: m.role, name: o.name, slug: o.slug }];
    });

    return Promise.resolve(rows);
  }
  archivedMembershipsOf(userId: string): Promise<Membership[]> {
    const rows = this.members.flatMap(m => {
      const o = this.orgs.get(m.orgId);
      if (m.userId !== userId || !o?.archivedAt || !isLive(m)) {
        return [];
      }

      return [{ orgId: o.id, role: m.role, name: o.name, slug: o.slug }];
    });

    return Promise.resolve(rows);
  }

  archive(actor: { userId: string; orgId: string }): Promise<{ archivedAt: string }> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      return Promise.reject(new OrgNotFoundError());
    }
    if (o.archivedAt) {
      return Promise.reject(new Error('This camp is already archived'));
    }
    o.archivedAt = new Date().toISOString();
    this.database.record(actor, 'org.archive', 'org', o.id);

    return Promise.resolve({ archivedAt: o.archivedAt });
  }

  unarchive(actor: { userId: string; orgId: string }): Promise<void> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      return Promise.reject(new OrgNotFoundError());
    }
    if (!o.archivedAt) {
      return Promise.reject(conflict('This camp is not archived'));
    }
    o.archivedAt = null;
    this.database.record(actor, 'org.unarchive', 'org', o.id);

    return Promise.resolve();
  }

  /** Removes the camp and its memberships. The people and attendance tables are not modelled here; the database test covers the full cascade. */
  deleteCamp(actor: { userId: string; orgId: string }, confirmName: string): Promise<void> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      return Promise.reject(new OrgNotFoundError());
    }
    if (o.name !== confirmName) {
      return Promise.reject(new Error('The camp name does not match'));
    }
    this.orgs.delete(o.id);
    for (let i = this.members.length - 1; i >= 0; i--) {
      if (this.members[i].orgId === o.id) {
        this.members.splice(i, 1);
      }
    }

    return Promise.resolve();
  }

  archivedCampsOf(userId: string): Promise<ArchivedCampRecord[]> {
    const rows = this.members.flatMap(m => {
      const o = this.orgs.get(m.orgId);
      if (m.userId !== userId || !o?.archivedAt) {
        return [];
      }

      return [{ id: o.id, name: o.name, archivedAt: o.archivedAt, role: m.role }];
    });

    return Promise.resolve(rows);
  }

  createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    if ([...this.orgs.values()].some(o => o.slug === input.slug)) {
      return Promise.reject(new SlugTakenError());
    }
    const org: StoredOrg = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      createdAt: new Date().toISOString(),
      timezone: input.timezone,
      clockFormat: DEFAULT_CLOCK_FORMAT,
      archivedAt: null,
    };
    this.orgs.set(org.id, org);
    this.members.push({ orgId: org.id, userId: ownerId, role: 'owner' });
    this.database.record({ userId: ownerId, orgId: org.id }, 'org.create', 'org', org.id);

    return Promise.resolve({ id: org.id, name: org.name, slug: org.slug, role: 'owner' });
  }

  get(_userId: string, orgId: string): Promise<Org> {
    const o = this.orgs.get(orgId);
    if (!o) {
      return Promise.reject(new OrgNotFoundError());
    }

    return Promise.resolve({ ...o, memberCount: this.members.filter(m => m.orgId === orgId).length });
  }

  rename(actor: { userId: string; orgId: string }, input: OrgPatchInput): Promise<OrgSummary> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      return Promise.reject(new OrgNotFoundError());
    }
    if (input.name !== undefined) {
      o.name = input.name;
    }
    if (input.timezone !== undefined) {
      o.timezone = input.timezone;
    }
    this.database.record(actor, 'org.update', 'org', o.id);

    return Promise.resolve({ id: o.id, name: o.name, slug: o.slug });
  }

  changeMemberRole(actor: Actor, userId: string, role: Role): Promise<void> {
    const member = this.members.find(m => m.orgId === actor.orgId && m.userId === userId);
    if (!member) {
      return Promise.reject(new OrgNotFoundError());
    }
    const from = member.role;
    member.role = role;
    this.database.record(actor, 'member.role_change', 'member', userId, { from, to: role });

    return Promise.resolve();
  }

  /** The same rule as the database (migration 0043): the owner rule and the self rule are checked by the service, as for a role. */
  setMemberExpiry(actor: Actor, userId: string, expiresAt: string | null): Promise<void> {
    const member = this.members.find(m => m.orgId === actor.orgId && m.userId === userId);
    if (!member) {
      return Promise.reject(new OrgNotFoundError());
    }
    const from = member.expiresAt ?? null;
    member.expiresAt = expiresAt;
    this.database.record(actor, expiresAt === null ? 'member.expiry_clear' : 'member.expiry_set', 'member', userId, {
      from,
      to: expiresAt,
    });

    return Promise.resolve();
  }

  listMembers(_userId: string, orgId: string): Promise<Member[]> {
    const rows: Member[] = [];
    for (const m of this.members) {
      if (m.orgId !== orgId) {
        continue;
      }
      const u = this.users.get(m.userId);
      if (!u) {
        return Promise.reject(new Error(`member ${m.userId} has no user record`));
      }
      rows.push({ id: u.id, name: u.name, email: u.email, role: m.role, expiresAt: m.expiresAt ?? null });
    }

    return Promise.resolve(rows);
  }

  asRepositories(): Repositories {
    const db = this.database;
    const classes = new InMemoryClassRepository();

    return {
      users: this,
      orgs: this,
      people: new InMemoryPeopleRepository(db),
      memberships: new InMemoryMembershipRepository(db),
      credentials: new InMemoryCredentialRepository(db),
      attendance: new InMemoryAttendanceRepository(db),
      classes,
      imports: new InMemoryImportRepository(classes),
      registration: new InMemoryRegistrationRepository(
        {},
        (orgId, answers) => camperIdsFor(db, orgId, answers),
        new InMemoryCredentialRepository(db),
      ),
      seatHolds: unavailableSeatHolds,
      calendar: new InMemoryCalendarRepository(),
      memberInvites: new InMemoryMemberInviteRepository(new Map()),
      // These tests create no public pages, so the public read finds nothing.
      publicSessions: {
        findPublicSession: () => Promise.resolve(null),
        listUpcomingClasses: () => Promise.resolve([]),
      },
    };
  }
}

/**
 * Seat holds need the database (their capacity rule is in migration 0023), so the in-memory store has none. Holds are tested
 * against Postgres in holds/__tests__; a test that reaches this stub fails loudly.
 */
/** The camper people a registration's answers name: active, with the camper role, same name and birth date (see camperIdsInTx). */
export function camperIdsFor(
  db: InMemoryDatabase,
  orgId: string,
  answers: { standard: Record<string, string> },
): string[] {
  const { camperFirstName, camperLastName, camperBirthDate } = answers.standard;
  const norm = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

  return [...db.people.values()]
    .filter(
      p =>
        p.orgId === orgId &&
        p.archivedAt === null &&
        p.roles.includes('camper') &&
        norm(p.givenName) === norm(camperFirstName) &&
        norm(p.familyName) === norm(camperLastName) &&
        p.dateOfBirth === camperBirthDate,
    )
    .map(p => p.id);
}

const unavailableSeatHolds: SeatHoldRepository = {
  placeHold: () => Promise.reject(new Error('Seat holds are only available on Postgres')),
  releaseHold: () => Promise.reject(new Error('Seat holds are only available on Postgres')),
  releaseExpiredHolds: () => Promise.reject(new Error('Seat holds are only available on Postgres')),
  campsWithExpiredHolds: () => Promise.reject(new Error('Seat holds are only available on Postgres')),
};

/** Repositories backed by memory, plus the audit log they write, for tests. */
export type InMemoryRepositories = Repositories & { readonly audit: readonly AuditRecord[] };

export function createInMemoryRepositories(): InMemoryRepositories {
  const store = new InMemoryStore();

  return Object.assign(store.asRepositories(), { audit: store.audit });
}
