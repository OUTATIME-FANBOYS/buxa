import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { personExists } from '../people/PgPersonQueries';
import { requireMembership, queryMemberships } from './PgMembershipQueries';
import type { MembershipRecord, MembershipRepository, NewMembershipRecord } from './MembershipRepository';

/** Postgres adapter for memberships. Reads are scoped by row-level security; writes audit in the same transaction. */
export class PgMembershipRepository implements MembershipRepository {
  constructor(private readonly pool: Pool) {}

  add(actor: Actor, input: NewMembershipRecord): Promise<MembershipRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      if (!(await personExists(db, input.personId))) throw new PersonNotFoundError();
      const { rows } = await db.query<{ id: string }>(
        'INSERT INTO memberships (org_id, person_id, plan, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [actor.orgId, input.personId, input.plan, input.startsOn, input.endsOn]);
      const id = rows[0].id;
      await recordAudit(db, { actor, action: 'membership.create', entity: 'membership', entityId: id, data: { personId: input.personId } });
      return requireMembership(db, id);
    });
  }

  revoke(actor: Actor, id: string, reason: string, at: string): Promise<MembershipRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      const current = await requireMembership(db, id);
      if (current.revokedAt === null) {
        await db.query('UPDATE memberships SET revoked_at = $2::timestamptz, revoked_reason = $3 WHERE id = $1', [id, at, reason]);
        await recordAudit(db, { actor, action: 'membership.revoke', entity: 'membership', entityId: id, data: { reason } });
      }
      return requireMembership(db, id);
    });
  }

  forPerson(orgId: string, personId: string): Promise<MembershipRecord[]> {
    if (!isUuid(personId)) return Promise.resolve([]);
    return withOrg(this.pool, orgId, db => queryMemberships(db, 'WHERE person_id = $1', [personId]));
  }

  forPeople(orgId: string, personIds: readonly string[]): Promise<MembershipRecord[]> {
    const valid = personIds.filter(isUuid);
    if (valid.length === 0) return Promise.resolve([]);
    return withOrg(this.pool, orgId, db => queryMemberships(db, 'WHERE person_id = ANY($1::uuid[])', [valid]));
  }
}
