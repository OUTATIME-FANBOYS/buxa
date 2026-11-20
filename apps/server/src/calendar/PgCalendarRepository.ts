import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor, FeedClass } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { toIso } from '../people/pgRows';
import type { CalendarRepository, FeedCamp } from './CalendarService';

interface FeedClassRow {
  id: string;
  class_name: string;
  starts_at: Date;
  ends_at: Date;
  location: string;
}

const toFeedClass = (r: FeedClassRow): FeedClass => ({
  id: r.id,
  className: r.class_name,
  startsAt: toIso(r.starts_at),
  endsAt: toIso(r.ends_at),
  location: r.location,
});

/** Postgres adapter for the calendar feed. Token lookup runs as a definer function with no camp; everything else is camp-scoped. */
export class PgCalendarRepository implements CalendarRepository {
  constructor(private readonly pool: Pool) {}

  findCampByTokenHash(hash: Buffer): Promise<FeedCamp | null> {
    return withOrg(this.pool, null, null, async db => {
      const { rows } = await db.query<{ camp_id: string; camp_name: string; camp_archived: boolean }>(
        'SELECT camp_id, camp_name, camp_archived FROM buxa_camp_for_calendar_token($1)',
        [hash],
      );
      const row = rows[0];

      return row ? { orgId: row.camp_id, name: row.camp_name, archived: row.camp_archived } : null;
    });
  }

  saveTokenHash(actor: Actor, hash: Buffer): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
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

  listFeedClasses(tokenHash: Buffer): Promise<FeedClass[]> {
    return withOrg(this.pool, null, null, async db => {
      // buxa_calendar_feed_classes (migration 0032) resolves the camp from the token and returns only its sessions.
      const { rows } = await db.query<FeedClassRow>(
        'SELECT id, class_name, starts_at, ends_at, location FROM buxa_calendar_feed_classes($1)',
        [tokenHash],
      );

      return rows.map(toFeedClass);
    });
  }

  findTeacherByTokenHash(hash: Buffer): Promise<FeedCamp | null> {
    return withOrg(this.pool, null, null, async db => {
      // buxa_teacher_for_calendar_token (migration 0033) returns nothing unless the token's holder is still a teacher.
      const { rows } = await db.query<{ camp_id: string; camp_name: string; camp_archived: boolean }>(
        'SELECT camp_id, camp_name, camp_archived FROM buxa_teacher_for_calendar_token($1)',
        [hash],
      );
      const row = rows[0];

      return row ? { orgId: row.camp_id, name: row.camp_name, archived: row.camp_archived } : null;
    });
  }

  saveMemberTokenHash(actor: Actor, hash: Buffer): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      // The row is the signed-in person's own (row-level security checks user_id), so one teacher cannot replace another's link.
      await db.query(
        `INSERT INTO member_calendar_tokens (org_id, user_id, token_hash) VALUES ($1, $2, $3)
         ON CONFLICT (org_id, user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now()`,
        [actor.orgId, actor.userId, hash],
      );
      // The audit entry records that the person's link changed, never the token or its hash.
      await recordAudit(db, {
        actor,
        action: 'calendar.token_rotate_self',
        entity: 'member',
        entityId: actor.userId,
        data: {},
      });
    });
  }

  listTeacherFeedClasses(tokenHash: Buffer): Promise<FeedClass[]> {
    return withOrg(this.pool, null, null, async db => {
      // buxa_teacher_calendar_feed_classes (migration 0033) returns only the classes assigned to the token's teacher.
      const { rows } = await db.query<FeedClassRow>(
        'SELECT id, class_name, starts_at, ends_at, location FROM buxa_teacher_calendar_feed_classes($1)',
        [tokenHash],
      );

      return rows.map(toFeedClass);
    });
  }
}
