import {
  planSessionDates,
  type Actor,
  type DatesPlanClass,
  type SessionDatesPlan,
  type SessionDays,
} from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { toIso, type Db } from '../people/pgRows';
import { SessionNotFoundError } from './errors';

/*
 * The database side of the session date flag (migration 0059). Each function runs inside the caller's transaction. The rules are in
 * packages/domain (planSessionDates); this file only reads what the rules need and writes the result.
 */

interface PlanRow {
  id: string;
  name: string;
  starts_at: Date;
  ends_at: Date;
  dates_outside_session: boolean;
  has_people: boolean;
}

/** The camp's zone, which decides the day a class is on. */
export async function campTimeZone(db: Db, orgId: string): Promise<string> {
  const { rows } = await db.query<{ timezone: string }>('SELECT timezone FROM orgs WHERE id = $1', [orgId]);

  return rows[0]?.timezone ?? 'UTC';
}

/**
 * The classes of a session with what a date change needs: times, the stored flag, and whether anyone is on the class. A class
 * has people when it has an enrolment, a seat hold or a registration; a check-in names the session, so one check-in counts for
 * every class in it. Throws SessionNotFoundError when the session is not in the camp.
 */
export async function readDatesPlanRows(db: Db, orgId: string, sessionId: string): Promise<DatesPlanClass[]> {
  const { rows: parent } = await db.query<{ id: string }>('SELECT id FROM classes WHERE id = $1 AND org_id = $2', [
    sessionId,
    orgId,
  ]);
  if (parent.length === 0) {
    throw new SessionNotFoundError();
  }
  const { rows } = await db.query<PlanRow>(
    `SELECT s.id, s.name, s.starts_at, s.ends_at, s.dates_outside_session,
            (EXISTS (SELECT 1 FROM enrolments e WHERE e.session_id = s.id)
             OR EXISTS (SELECT 1 FROM seat_holds h WHERE h.session_id = s.id)
             OR EXISTS (SELECT 1 FROM registration_classes rc WHERE rc.class_id = s.id)
             OR EXISTS (SELECT 1 FROM check_ins ci WHERE ci.org_id = s.org_id AND ci.session_id = $1)) AS has_people
       FROM sessions s
      WHERE s.class_id = $1 AND s.org_id = $2
      ORDER BY s.starts_at, s.id`,
    [sessionId, orgId],
  );

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    startsAt: toIso(r.starts_at),
    endsAt: toIso(r.ends_at),
    datesOutsideSession: r.dates_outside_session,
    hasPeople: r.has_people,
  }));
}

/** Plans the flags for a session's new days, reading the classes inside the transaction. */
export async function planDatesChange(
  db: Db,
  orgId: string,
  sessionId: string,
  days: SessionDays,
): Promise<SessionDatesPlan> {
  const classes = await readDatesPlanRows(db, orgId, sessionId);

  return planSessionDates(classes, days, await campTimeZone(db, orgId));
}

/**
 * Writes the flags of a plan: every class outside the new days is flagged, every flagged class the days cover again is cleared.
 * Audits `class.dates_flagged` for each newly flagged class, with the session's new days. The class times are not touched.
 */
export async function applyDatesPlan(
  db: Db,
  actor: Actor,
  sessionId: string,
  sessionName: string,
  days: SessionDays,
  plan: SessionDatesPlan,
): Promise<void> {
  await db.query(
    `UPDATE sessions SET dates_outside_session = (id = ANY($3::uuid[]))
      WHERE class_id = $1 AND org_id = $2
        AND dates_outside_session IS DISTINCT FROM (id = ANY($3::uuid[]))`,
    [sessionId, actor.orgId, plan.outside.map(c => c.id)],
  );
  for (const cls of plan.newlyFlagged) {
    await recordAudit(db, {
      actor,
      action: 'class.dates_flagged',
      entity: 'class',
      entityId: cls.id,
      data: { name: cls.name, session: sessionName, startsOn: days.startsOn, endsOn: days.endsOn },
    });
  }
}

/** The names of the flagged classes of a session, in start order. Used to refuse a publish. */
export async function flaggedClassNames(db: Db, orgId: string, sessionId: string): Promise<string[]> {
  const { rows } = await db.query<{ name: string }>(
    `SELECT s.name FROM sessions s
      WHERE s.class_id = $1 AND s.org_id = $2 AND s.dates_outside_session
      ORDER BY s.starts_at, s.id`,
    [sessionId, orgId],
  );

  return rows.map(r => r.name);
}
