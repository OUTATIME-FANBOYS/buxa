import type { Pool } from 'pg';
import type { CreatedOrg, Member, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import { isUniqueViolation, transaction, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { OrgNotFoundError, SlugTakenError, type OrgRepository } from './OrgRepository';

interface OrgRow { id: string; name: string; slug: string; created_at: Date; member_count: number }

export class PgOrgRepository implements OrgRepository {
  constructor(private readonly pool: Pool) {}

  /** The organisation does not exist yet, so row-level security cannot scope this one; it uses the privileged pool. */
  async createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    try {
      return await transaction(this.pool, async db => {
        const { rows } = await db.query<OrgSummary>('INSERT INTO orgs(name, slug) VALUES ($1, $2) RETURNING id, name, slug', [input.name, input.slug]);
        const org = rows[0];
        await db.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1, $2, 'owner')`, [org.id, ownerId]);
        await recordAudit(db, { actor: { userId: ownerId, orgId: org.id }, action: 'org.create', entity: 'org', entityId: org.id });
        return { ...org, role: 'owner' };
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new SlugTakenError() : error;
    }
  }

  get(orgId: string): Promise<Org> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<OrgRow>(
        `SELECT id, name, slug, created_at, (SELECT count(*)::int FROM org_members) AS member_count FROM orgs`);
      if (!rows[0]) throw new OrgNotFoundError();
      const row = rows[0];
      return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at.toISOString(), memberCount: row.member_count };
    });
  }

  rename(actor: Actor, input: OrgPatchInput): Promise<OrgSummary> {
    return withOrg(this.pool, actor.orgId, async db => {
      const { rows } = await db.query<OrgSummary>('UPDATE orgs SET name = $1 WHERE id = $2 RETURNING id, name, slug', [input.name, actor.orgId]);
      if (!rows[0]) throw new OrgNotFoundError();
      await recordAudit(db, { actor, action: 'org.update', entity: 'org', entityId: actor.orgId, data: { name: input.name } });
      return rows[0];
    });
  }

  listMembers(orgId: string): Promise<Member[]> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<Member>(
        `SELECT u.id, u.name, u.email, m.role FROM org_members m JOIN users u ON u.id = m.user_id ORDER BY u.name`);
      return rows;
    });
  }
}
