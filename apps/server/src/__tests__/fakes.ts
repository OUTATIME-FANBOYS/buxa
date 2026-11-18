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
import { DEFAULT_CLOCK_FORMAT, type Role } from '@buxa/domain';
import type { Identity } from '../auth/identity';
import { InMemoryAttendanceRepository } from '../attendance/InMemoryAttendanceRepository';
import { InMemoryClassRepository } from '../classes/InMemoryClassRepository';
import { InMemoryCredentialRepository } from '../credentials/InMemoryCredentialRepository';
import { InMemoryMembershipRepository } from '../memberships/InMemoryMembershipRepository';
import { OrgNotFoundError, SlugTakenError, type ArchivedCampRecord, type OrgRepository } from '../orgs/OrgRepository';
import { InMemoryPeopleRepository } from '../people/InMemoryPeopleRepository';
import { InMemoryDatabase, type AuditRecord } from '../people/InMemoryDatabase';
import type { Repositories } from '../repositories';
import { EmailInUseError, type UserRepository } from '../users/UserRepository';

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
  readonly members: { orgId: string; userId: string; role: Role }[] = [];
  private readonly database = new InMemoryDatabase();

  /** Every audit row written through this store's adapters, oldest first. */
  get audit(): readonly AuditRecord[] {
    return this.database.audit;
  }

  async upsertFromIdentity(identity: Identity): Promise<User> {
    const existing = [...this.users.values()].find(u => u.authId === identity.authId);
    if (existing) {
      return { id: existing.id, email: existing.email, name: existing.name };
    }
    if ([...this.users.values()].some(u => u.email === identity.email)) {
      throw new EmailInUseError();
    }
    const user = { id: randomUUID(), authId: identity.authId, email: identity.email, name: identity.name };
    this.users.set(user.id, user);

    return { id: user.id, email: user.email, name: user.name };
  }
  async updateName(userId: string, name: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('no user to rename');
    }
    user.name = name;

    return { id: user.id, email: user.email, name: user.name };
  }
  async membershipsOf(userId: string): Promise<Membership[]> {
    return this.members
      .filter(m => m.userId === userId && !this.orgs.get(m.orgId)!.archivedAt)
      .map(m => {
        const o = this.orgs.get(m.orgId)!;

        return { orgId: o.id, role: m.role, name: o.name, slug: o.slug };
      });
  }
  async archivedMembershipsOf(userId: string): Promise<Membership[]> {
    return this.members
      .filter(m => m.userId === userId && this.orgs.get(m.orgId)!.archivedAt)
      .map(m => {
        const o = this.orgs.get(m.orgId)!;

        return { orgId: o.id, role: m.role, name: o.name, slug: o.slug };
      });
  }
  async archive(actor: { userId: string; orgId: string }): Promise<{ archivedAt: string }> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      throw new OrgNotFoundError();
    }
    if (o.archivedAt) {
      throw new Error('This camp is already archived');
    }
    o.archivedAt = new Date().toISOString();
    this.database.record(actor, 'org.archive', 'org', o.id);

    return { archivedAt: o.archivedAt };
  }
  /** Removes the camp and its memberships. The people and attendance tables are not modelled here; the database test covers the full cascade. */
  async deleteCamp(actor: { userId: string; orgId: string }, confirmName: string): Promise<void> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      throw new OrgNotFoundError();
    }
    if (o.name !== confirmName) {
      throw new Error('The camp name does not match');
    }
    this.orgs.delete(o.id);
    for (let i = this.members.length - 1; i >= 0; i--) {
      if (this.members[i].orgId === o.id) {
        this.members.splice(i, 1);
      }
    }
  }
  async archivedCampsOf(userId: string): Promise<ArchivedCampRecord[]> {
    return this.members
      .filter(m => m.userId === userId && this.orgs.get(m.orgId)!.archivedAt)
      .map(m => {
        const o = this.orgs.get(m.orgId)!;

        return { id: o.id, name: o.name, archivedAt: o.archivedAt!, role: m.role };
      });
  }
  async createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    if ([...this.orgs.values()].some(o => o.slug === input.slug)) {
      throw new SlugTakenError();
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

    return { id: org.id, name: org.name, slug: org.slug, role: 'owner' };
  }
  async get(orgId: string): Promise<Org> {
    const o = this.orgs.get(orgId);
    if (!o) {
      throw new OrgNotFoundError();
    }

    return { ...o, memberCount: this.members.filter(m => m.orgId === orgId).length };
  }
  async rename(actor: { userId: string; orgId: string }, input: OrgPatchInput): Promise<OrgSummary> {
    const o = this.orgs.get(actor.orgId);
    if (!o) {
      throw new OrgNotFoundError();
    }
    if (input.name !== undefined) {
      o.name = input.name;
    }
    if (input.timezone !== undefined) {
      o.timezone = input.timezone;
    }
    if (input.clockFormat !== undefined) {
      o.clockFormat = input.clockFormat;
    }
    this.database.record(actor, 'org.update', 'org', o.id);

    return { id: o.id, name: o.name, slug: o.slug };
  }
  async listMembers(orgId: string): Promise<Member[]> {
    return this.members
      .filter(m => m.orgId === orgId)
      .map(m => {
        const u = this.users.get(m.userId)!;

        return { id: u.id, name: u.name, email: u.email, role: m.role };
      });
  }
  asRepositories(): Repositories {
    const db = this.database;

    return {
      users: this,
      orgs: this,
      people: new InMemoryPeopleRepository(db),
      memberships: new InMemoryMembershipRepository(db),
      credentials: new InMemoryCredentialRepository(db),
      attendance: new InMemoryAttendanceRepository(db),
      classes: new InMemoryClassRepository(),
    };
  }
}

/** Repositories backed by memory, plus the audit log they write, for tests. */
export type InMemoryRepositories = Repositories & { readonly audit: readonly AuditRecord[] };

export function createInMemoryRepositories(): InMemoryRepositories {
  const store = new InMemoryStore();

  return Object.assign(store.asRepositories(), { audit: store.audit });
}
