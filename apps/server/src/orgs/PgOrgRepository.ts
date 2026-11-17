import type { Pool } from 'pg';
import type { ClockFormat, CreatedOrg, Member, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import { isUniqueViolation, withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { OrgNotFoundError, SlugTakenError, type OrgRepository } from './OrgRepository';

interface OrgRow { id: string; name: string; slug: string; created_at: Date; member_count: number; timezone: string; clock_format: ClockFormat }

export class PgOrgRepository implements OrgRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * The organisation does not exist yet, so row-level security cannot scope this write. buxa_create_org (migration 0009)
   * creates the organisation, its owner membership and the audit row in one statement, as the request role.
   */
  async createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    try {
      const { rows } = await withOrg(this.pool, null, db => db.query<OrgSummary>(
        'SELECT org_id AS id, org_name AS name, org_slug AS slug FROM buxa_create_org($1, $2, $3, $4)',
        [input.name, input.slug, input.timezone, ownerId]));

      return { ...rows[0], role: 'owner' };
    } catch (error) {
      throw isUniqueViolation(error) ? new SlugTakenError() : error;
    }
  }

  get(orgId: string): Promise<Org> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<OrgRow>(
        `SELECT id, name, slug, timezone, clock_format, created_at, (SELECT count(*)::int FROM org_members) AS member_count FROM orgs`);
      if (!rows[0]) {
        throw new OrgNotFoundError();
      }
      const row = rows[0];

      return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at.toISOString(), memberCount: row.member_count, timezone: row.timezone, clockFormat: row.clock_format };
    });
  }

  rename(actor: Actor, input: OrgPatchInput): Promise<OrgSummary> {
    return withOrg(this.pool, actor.orgId, async db => {
      const { rows } = await db.query<OrgSummary>(
        `UPDATE orgs SET name = coalesce($1, name), timezone = coalesce($2, timezone), clock_format = coalesce($3, clock_format)
         WHERE id = $4 RETURNING id, name, slug`,
        [input.name ?? null, input.timezone ?? null, input.clockFormat ?? null, actor.orgId]);
      if (!rows[0]) {
        throw new OrgNotFoundError();
      }
      await recordAudit(db, { actor, action: 'org.update', entity: 'org', entityId: actor.orgId, data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.clockFormat !== undefined && { clockFormat: input.clockFormat }),
      } });

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
