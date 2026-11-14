import type { Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { compareText, instant, newId, type InMemoryDatabase, type StoredMembership } from '../people/InMemoryDatabase';
import { MembershipNotFoundError, type MembershipRecord, type MembershipRepository, type NewMembershipRecord } from './MembershipRepository';

const toRecord = (m: StoredMembership): MembershipRecord => ({
  id: m.id,
  personId: m.personId,
  plan: m.plan,
  startsOn: m.startsOn,
  endsOn: m.endsOn,
  revokedAt: m.revokedAt,
  revokedReason: m.revokedReason,
});

/** In-memory adapter for memberships, with the same errors, audit entries and ordering as the Postgres adapter. */
export class InMemoryMembershipRepository implements MembershipRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async add(actor: Actor, input: NewMembershipRecord): Promise<MembershipRecord> {
    if (!this.db.inOrg(this.db.people, actor.orgId, input.personId)) throw new PersonNotFoundError();
    const membership: StoredMembership = {
      id: newId(),
      orgId: actor.orgId,
      personId: input.personId,
      plan: input.plan,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      revokedAt: null,
      revokedReason: null,
    };
    this.db.memberships.set(membership.id, membership);
    this.db.record(actor, 'membership.create', 'membership', membership.id, { personId: input.personId });
    return toRecord(membership);
  }

  async revoke(actor: Actor, id: string, reason: string, at: string): Promise<MembershipRecord> {
    const membership = this.db.inOrg(this.db.memberships, actor.orgId, id);
    if (!membership) throw new MembershipNotFoundError();
    if (membership.revokedAt === null) {
      membership.revokedAt = instant(at);
      membership.revokedReason = reason;
      this.db.record(actor, 'membership.revoke', 'membership', id, { reason });
    }
    return toRecord(membership);
  }

  async forPerson(orgId: string, personId: string): Promise<MembershipRecord[]> {
    return this.visible(orgId, m => m.personId === personId);
  }

  async forPeople(orgId: string, personIds: readonly string[]): Promise<MembershipRecord[]> {
    return this.visible(orgId, m => personIds.includes(m.personId));
  }

  private visible(orgId: string, keep: (m: StoredMembership) => boolean): MembershipRecord[] {
    return [...this.db.memberships.values()]
      .filter(m => m.orgId === orgId && keep(m))
      .sort((a, b) => compareText(a.startsOn, b.startsOn) || compareText(a.id, b.id))
      .map(toRecord);
  }
}
