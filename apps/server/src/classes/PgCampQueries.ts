import type { Db } from '../people/pgRows';
import { toIso } from '../people/pgRows';
import type { CampActiveHold, CampWaitlistEntry } from './ClassRepository';

/*
 * The camp-wide reads behind the holds screen: every live seat hold and every waitlisted camper, each in one statement. Row-level
 * security scopes both to the camp. Names are joined here so the screen needs no further reads.
 *
 * Words: a `classes` row is a session (the parent: a date range); a `sessions` row is a class (what a family registers for). A
 * seat hold and an enrolment both sit on a class.
 */

/** The live holds (unreleased, not yet expired), soonest expiry first. The child is the one a registration took the hold for. */
export async function listCampActiveHoldRows(db: Db): Promise<CampActiveHold[]> {
  const { rows } = await db.query<{
    id: string;
    session_id: string;
    session_name: string;
    class_id: string;
    class_name: string;
    household_id: string;
    household_name: string;
    child_name: string | null;
    created_at: Date;
    expires_at: Date;
  }>(
    `SELECT h.id, p.id AS session_id, p.name AS session_name, s.id AS class_id, s.name AS class_name,
            hh.id AS household_id, hh.name AS household_name,
            (SELECT trim(pe.given_name || ' ' || pe.family_name)
               FROM registration_classes rc
               JOIN people pe ON pe.id = rc.person_id AND pe.org_id = rc.org_id
              WHERE rc.hold_id = h.id
              ORDER BY rc.created_at, rc.id
              LIMIT 1) AS child_name,
            h.created_at, h.expires_at
       FROM seat_holds h
       JOIN sessions s ON s.id = h.session_id AND s.org_id = h.org_id
       JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
       JOIN households hh ON hh.id = h.household_id AND hh.org_id = h.org_id
      WHERE h.released_at IS NULL AND h.expires_at > now()
      ORDER BY h.expires_at, h.id`,
  );

  return rows.map(r => ({
    id: r.id,
    sessionId: r.session_id,
    sessionName: r.session_name,
    classId: r.class_id,
    className: r.class_name,
    householdId: r.household_id,
    householdName: r.household_name,
    childName: r.child_name,
    createdAt: toIso(r.created_at),
    expiresAt: toIso(r.expires_at),
  }));
}

/** The waitlisted enrolments, by class start and then by when each camper joined (the order they are promoted in). */
export async function listCampWaitlistRows(db: Db): Promise<CampWaitlistEntry[]> {
  const { rows } = await db.query<{
    enrolment_id: string;
    session_id: string;
    session_name: string;
    class_id: string;
    class_name: string;
    household_name: string | null;
    camper_name: string;
    created_at: Date;
  }>(
    `SELECT e.id AS enrolment_id, p.id AS session_id, p.name AS session_name, s.id AS class_id, s.name AS class_name,
            (SELECT hh.name
               FROM household_members hm
               JOIN households hh ON hh.id = hm.household_id AND hh.org_id = hm.org_id
              WHERE hm.person_id = e.person_id AND hm.org_id = e.org_id
              ORDER BY hh.name, hh.id
              LIMIT 1) AS household_name,
            trim(pe.given_name || ' ' || pe.family_name) AS camper_name,
            e.created_at
       FROM enrolments e
       JOIN sessions s ON s.id = e.session_id AND s.org_id = e.org_id
       JOIN classes p ON p.id = s.class_id AND p.org_id = s.org_id
       JOIN people pe ON pe.id = e.person_id AND pe.org_id = e.org_id
      WHERE e.status = 'waitlisted'
      ORDER BY s.starts_at, s.id, e.created_at, e.id`,
  );

  return rows.map(r => ({
    enrolmentId: r.enrolment_id,
    sessionId: r.session_id,
    sessionName: r.session_name,
    classId: r.class_id,
    className: r.class_name,
    householdName: r.household_name,
    camperName: r.camper_name,
    joinedAt: toIso(r.created_at),
  }));
}
