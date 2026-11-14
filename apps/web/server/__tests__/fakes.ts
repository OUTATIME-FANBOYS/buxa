import { randomUUID } from 'node:crypto';
import type { CreatedOrg, Member, Membership, NewOrgInput, Org, OrgPatchInput, OrgSummary, User } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import type { Identity } from '../auth/identity';
import { InMemoryAttendanceRepository } from '../attendance';
import { InMemoryCredentialRepository } from '../credentials';
import { InMemoryMembershipRepository } from '../memberships';
import { OrgNotFoundError, SlugTakenError, type OrgRepository } from '../orgs/OrgRepository';
import { InMemoryPeopleRepository, InMemoryDatabase, type AuditRecord } from '../people';
import type { Repositories } from '../repositories';
import { EmailInUseError, type UserRepository } from '../users/UserRepository';

interface StoredOrg { id: string; name: string; slug: string; createdAt: string; timezone: string }

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
    if (existing) return { id: existing.id, email: existing.email, name: existing.name };
    if ([...this.users.values()].some(u => u.email === identity.email)) throw new EmailInUseError();
    const user = { id: randomUUID(), authId: identity.authId, email: identity.email, name: identity.name };
    this.users.set(user.id, user);
    return { id: user.id, email: user.email, name: user.name };
  }
  async membershipsOf(userId: string): Promise<Membership[]> {
    return this.members.filter(m => m.userId === userId).map(m => { const o = this.orgs.get(m.orgId)!; return { orgId: o.id, role: m.role, name: o.name, slug: o.slug }; });
  }
  async createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    if ([...this.orgs.values()].some(o => o.slug === input.slug)) throw new SlugTakenError();
    const org = { id: randomUUID(), name: input.name, slug: input.slug, createdAt: new Date().toISOString(), timezone: input.timezone };
    this.orgs.set(org.id, org);
    this.members.push({ orgId: org.id, userId: ownerId, role: 'owner' });
    this.database.record({ userId: ownerId, orgId: org.id }, 'org.create', 'org', org.id);
    return { id: org.id, name: org.name, slug: org.slug, role: 'owner' };
  }
  async get(orgId: string): Promise<Org> {
    const o = this.orgs.get(orgId); if (!o) throw new OrgNotFoundError();
    return { ...o, memberCount: this.members.filter(m => m.orgId === orgId).length };
  }
  async rename(actor: { userId: string; orgId: string }, input: OrgPatchInput): Promise<OrgSummary> {
    const o = this.orgs.get(actor.orgId); if (!o) throw new OrgNotFoundError();
    if (input.name !== undefined) o.name = input.name;
    if (input.timezone !== undefined) o.timezone = input.timezone;
    this.database.record(actor, 'org.update', 'org', o.id);
    return { id: o.id, name: o.name, slug: o.slug };
  }
  async listMembers(orgId: string): Promise<Member[]> {
    return this.members.filter(m => m.orgId === orgId).map(m => { const u = this.users.get(m.userId)!; return { id: u.id, name: u.name, email: u.email, role: m.role }; });
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
    };
  }
}

/** Repositories backed by memory, plus the audit log they write, for tests. */
export type InMemoryRepositories = Repositories & { readonly audit: readonly AuditRecord[] };

export function createInMemoryRepositories(): InMemoryRepositories {
  const store = new InMemoryStore();
  return Object.assign(store.asRepositories(), { audit: store.audit });
}
