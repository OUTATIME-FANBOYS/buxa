import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { toIso } from '../people/pgRows';
import type { PublicClass, PublicSessionRecord, PublicSessionRepository } from './PublicSessionService';

/**
 * Postgres adapter for the public session pages. There is no signed-in user, so both reads go through the definer functions in
 * migration 0029, which return only what a visitor may see. They run with no camp context.
 */
export class PgPublicSessionRepository implements PublicSessionRepository {
  constructor(private readonly pool: Pool) {}

  findPublicSession(slug: string, sessionId: string): Promise<PublicSessionRecord | null> {
    return withOrg(this.pool, null, async db => {
      const { rows } = await db.query<{
        camp_name: string;
        camp_timezone: string;
        session_name: string;
        session_description: string | null;
        starts_on: string | null;
        ends_on: string | null;
      }>(
        `SELECT camp_name, camp_timezone, session_name, session_description,
                to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
           FROM buxa_public_session($1, $2)`,
        [slug, sessionId],
      );
      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        campName: row.camp_name,
        campTimeZone: row.camp_timezone,
        sessionName: row.session_name,
        description: row.session_description ?? '',
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      };
    });
  }

  listUpcomingClasses(slug: string, sessionId: string, from: Date): Promise<PublicClass[]> {
    return withOrg(this.pool, null, async db => {
      const { rows } = await db.query<{
        class_name: string;
        age_min: number | null;
        age_max: number | null;
        location: string;
        starts_at: Date;
        ends_at: Date;
      }>('SELECT * FROM buxa_public_classes($1, $2, $3)', [slug, sessionId, from]);

      return rows.map(r => ({
        name: r.class_name,
        ageMin: r.age_min,
        ageMax: r.age_max,
        location: r.location,
        startsAt: toIso(r.starts_at),
        endsAt: toIso(r.ends_at),
      }));
    });
  }
}
