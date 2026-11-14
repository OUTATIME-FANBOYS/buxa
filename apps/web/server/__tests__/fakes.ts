import { randomUUID } from 'node:crypto';
import type { CreatedOrg, Member, Membership, NewOrgInput, Org, OrgPatchInput, OrgSummary, User } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import type { Identity } from '../auth/identity';
import { OrgNotFoundError, SlugTakenError, type OrgRepository } from '../orgs/OrgRepository';
import type { Repositories } from '../repositories';
import { unimplemented } from '../unimplemented';
import { EmailInUseError, type UserRepository } from '../users/UserRepository';

interface StoredOrg { id: string; name: string; slug: string; createdAt: string; timezone: string }

/** An in-memory stand-in for Postgres. It is the second adapter that makes the repository interfaces a real seam. */
export class InMemoryStore implements UserRepository, OrgRepository {
  readonly users = new Map<string, User & { authId: string }>();
  readonly orgs = new Map<string, StoredOrg>();
  readonly members: { orgId: string; userId: string; role: Role }[] = [];
  readonly audit: { action: string; orgId: string; actorId: string }[] = [];

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
    this.audit.push({ action: 'org.create', orgId: org.id, actorId: ownerId });
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
    this.audit.push({ action: 'org.update', orgId: o.id, actorId: actor.userId });
    return { id: o.id, name: o.name, slug: o.slug };
  }
  async listMembers(orgId: string): Promise<Member[]> {
    return this.members.filter(m => m.orgId === orgId).map(m => { const u = this.users.get(m.userId)!; return { id: u.id, name: u.name, email: u.email, role: m.role }; });
  }
  asRepositories(): Repositories {
    // The phase 1 in-memory adapters replace these placeholders in chunk P1.
    return {
      users: this, orgs: this,
      people: unimplemented('PeopleRepository'), memberships: unimplemented('MembershipRepository'),
      credentials: unimplemented('CredentialRepository'), attendance: unimplemented('AttendanceRepository'),
    };
  }
}
