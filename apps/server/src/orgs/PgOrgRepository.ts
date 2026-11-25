import type { Pool } from 'pg';
import type { CreatedOrg, Member, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import { errorMessage, isUniqueViolation, withOrg } from '@buxa/db';
import type { Actor, Role } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { nullableIso } from '../people/pgRows';
import { badRequest, conflict, forbidden } from '../http/errors';
import { OrgNotFoundError, SlugTakenError, type ArchivedCampRecord, type OrgRepository } from './OrgRepository';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  member_count: number;
  timezone: string;
  hold_minutes: number | null;
}

export class PgOrgRepository implements OrgRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * The organisation does not exist yet, so row-level security cannot scope this write. buxa_create_org (migration 0009)
   * creates the organisation, its owner membership and the audit row in one statement, as the request role.
   */
  async createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg> {
    try {
      const { rows } = await withOrg(this.pool, ownerId, null, db =>
        db.query<OrgSummary>(
          'SELECT org_id AS id, org_name AS name, org_slug AS slug FROM buxa_create_org($1, $2, $3)',
          [input.name, input.slug, input.timezone],
        ),
      );

      return { ...rows[0], role: 'owner' };
    } catch (error) {
      throw isUniqueViolation(error) ? new SlugTakenError() : error;
    }
  }

  get(userId: string, orgId: string): Promise<Org> {
    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<OrgRow>(
        `SELECT id, name, slug, timezone, hold_minutes, created_at, (SELECT count(*)::int FROM org_members) AS member_count FROM orgs`,
      );
      if (!rows[0]) {
        throw new OrgNotFoundError();
      }
      const row = rows[0];

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.created_at.toISOString(),
        memberCount: row.member_count,
        timezone: row.timezone,
        holdMinutes: row.hold_minutes,
      };
    });
  }

  rename(actor: Actor, input: OrgPatchInput): Promise<OrgSummary> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const { rows } = await db.query<OrgSummary>(
        `UPDATE orgs SET name = coalesce($1, name), timezone = coalesce($2, timezone)
         WHERE id = $3 RETURNING id, name, slug`,
        [input.name ?? null, input.timezone ?? null, actor.orgId],
      );
      if (!rows[0]) {
        throw new OrgNotFoundError();
      }
      await recordAudit(db, {
        actor,
        action: 'org.update',
        entity: 'org',
        entityId: actor.orgId,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
        },
      });

      return rows[0];
    });
  }

  /**
   * The camp's seat hold length. The database checks the range (migration 0047) and the row policy lets only an admin or the
   * owner update it (0036). A refused update changes no row, so it is reported as the camp not being visible to the caller.
   */
  async setHoldMinutes(actor: Actor, minutes: number | null): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const { rows } = await db.query<{ id: string }>(
          `UPDATE orgs SET hold_minutes = $1 WHERE id = $2 RETURNING id`,
          [minutes, actor.orgId],
        );
        if (!rows[0]) {
          throw new OrgNotFoundError();
        }
        await recordAudit(db, {
          actor,
          action: 'org.update',
          entity: 'org',
          entityId: actor.orgId,
          data: { holdMinutes: minutes },
        });
      });
    } catch (error) {
      throw isHoldMinutesViolation(error)
        ? badRequest('Enter between 5 and 60 minutes, or leave it empty for the default.')
        : error;
    }
  }

  listMembers(userId: string, orgId: string): Promise<Member[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<{
        id: string;
        name: string;
        email: string;
        role: Role;
        expires_at: Date | null;
        instructor: boolean;
      }>(
        `SELECT u.id, u.name, u.email, m.role, m.expires_at,
                EXISTS (SELECT 1 FROM people p JOIN person_roles r ON r.org_id = p.org_id AND r.person_id = p.id
                         WHERE p.org_id = m.org_id AND p.user_id = m.user_id AND r.role = 'instructor') AS instructor
           FROM org_members m JOIN users u ON u.id = m.user_id ORDER BY u.name`,
      );

      return rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        instructor: r.instructor,
        expiresAt: nullableIso(r.expires_at),
      }));
    });
  }

  /** buxa_set_member_expiry (migration 0043) checks the actor's role and the owner rule, and writes the audit row. */
  async setMemberExpiry(actor: Actor, userId: string, expiresAt: string | null): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, db =>
        db.query('SELECT buxa_set_member_expiry($1, $2, $3)', [actor.orgId, userId, expiresAt]),
      );
    } catch (error) {
      throw mapCampFunctionError(error);
    }
  }

  /** buxa_change_member_role (migration 0039) checks the actor's role, the last owner and the archive, and writes the audit row. */
  async changeMemberRole(actor: Actor, userId: string, role: Role): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, db =>
        db.query('SELECT buxa_change_member_role($1, $2, $3, $4)', [actor.orgId, actor.userId, userId, role]),
      );
    } catch (error) {
      throw mapCampFunctionError(error);
    }
  }

  /** buxa_archive_camp (migration 0013) checks the owner role, refuses an archived camp and writes the audit row in one statement. */
  async archive(actor: Actor): Promise<{ archivedAt: string }> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const { rows } = await db.query<{ archived_at: Date }>('SELECT buxa_archive_camp($1) AS archived_at', [
          actor.orgId,
        ]);

        return { archivedAt: rows[0].archived_at.toISOString() };
      });
    } catch (error) {
      throw mapCampFunctionError(error);
    }
  }

  /** buxa_unarchive_camp (migration 0017) checks the owner role, refuses a camp that is not archived and writes the audit row. */
  async unarchive(actor: Actor): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, db =>
        db.query('SELECT buxa_unarchive_camp($1)', [actor.orgId]),
      );
    } catch (error) {
      throw mapCampFunctionError(error);
    }
  }

  /** buxa_delete_camp (migration 0013) checks the owner role and the exact name, then deletes the camp; the rows go with it. */
  async deleteCamp(actor: Actor, confirmName: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, db =>
        db.query('SELECT buxa_delete_camp($1, $2)', [actor.orgId, confirmName]),
      );
    } catch (error) {
      throw mapCampFunctionError(error);
    }
  }

  /** buxa_archived_camps_of (migration 0013) runs as the function owner, because the camp is not the current one. */
  archivedCampsOf(userId: string): Promise<ArchivedCampRecord[]> {
    return withOrg(this.pool, userId, null, async db => {
      const { rows } = await db.query<{ id: string; name: string; archived_at: Date; role: Role }>(
        'SELECT camp_id AS id, camp_name AS name, camp_archived_at AS archived_at, camp_role AS role FROM buxa_archived_camps_of()',
      );

      return rows.map(r => ({ id: r.id, name: r.name, archivedAt: r.archived_at.toISOString(), role: r.role }));
    });
  }
}

/** Maps the errors the 0013 functions raise to the ones the service and the client understand. Anything else is rethrown. */
function mapCampFunctionError(error: unknown): unknown {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const message = errorMessage(error);
  switch (code) {
    case '42501':
      return forbidden(message);
    case 'P0002':
      return new OrgNotFoundError();
    case '22023':
      return conflict(message);
    default:
      return error;
  }
}

/** True when the database refused the hold length range (the orgs_hold_minutes_check constraint, migration 0047). */
function isHoldMinutesViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23514' &&
    'constraint' in error &&
    error.constraint === 'orgs_hold_minutes_check'
  );
}
