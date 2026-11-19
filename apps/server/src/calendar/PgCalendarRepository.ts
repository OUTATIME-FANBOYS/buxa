import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor, FeedClass } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { toIso } from '../people/pgRows';
import type { CalendarRepository, FeedCamp } from './CalendarService';

/** Postgres adapter for the calendar feed. Token lookup runs as a definer function with no camp; everything else is camp-scoped. */
export class PgCalendarRepository implements CalendarRepository {
  constructor(private readonly pool: Pool) {}

  findCampByTokenHash(hash: Buffer): Promise<FeedCamp | null> {
    return withOrg(this.pool, null, async db => {
      const { rows } = await db.query<{ camp_id: string; camp_name: string; camp_archived: boolean }>(
        'SELECT camp_id, camp_name, camp_archived FROM buxa_camp_for_calendar_token($1)',
        [hash],
      );
      const row = rows[0];

      return row ? { orgId: row.camp_id, name: row.camp_name, archived: row.camp_archived } : null;
    });
  }

  saveTokenHash(actor: Actor, hash: Buffer): Promise<void> {
    return withOrg(this.pool, actor.orgId, async db => {
      await db.query(
        `INSERT INTO camp_calendar_tokens (org_id, token_hash) VALUES ($1, $2)
         ON CONFLICT (org_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now()`,
        [actor.orgId, hash],
      );
      // The audit entry records that the token changed, never the token or its hash.
      await recordAudit(db, {
        actor,
        action: 'calendar.token_rotate',
        entity: 'camp',
        entityId: actor.orgId,
        data: {},
      });
    });
  }

  listFeedClasses(orgId: string): Promise<FeedClass[]> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<{
        id: string;
        class_name: string;
        starts_at: Date;
        ends_at: Date;
        location: string;
      }>(
        // A class row carries its own name (migration 0022), so the feed needs no join.
        `SELECT s.id, s.name AS class_name, s.starts_at, s.ends_at, s.location
           FROM sessions s
          ORDER BY s.starts_at, s.id`,
      );

      return rows.map(r => ({
        id: r.id,
        className: r.class_name,
        startsAt: toIso(r.starts_at),
        endsAt: toIso(r.ends_at),
        location: r.location,
      }));
    });
  }
}
