import type { CheckInMethod } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { nullableIso, toIso, type Db, type SqlParam } from '../people/pgRows';
import { NotOnSiteError, type CheckInRecord } from './AttendanceRepository';

interface CheckInRow {
  id: string;
  person_id: string;
  checked_in_at: Date;
  checked_in_by: string | null;
  method: CheckInMethod;
  checked_out_at: Date | null;
  checked_out_by: string | null;
  collected_by_person_id: string | null;
  override_reason: string | null;
  note: string | null;
  session_id: string | null;
  session_unassigned: boolean;
  session_name: string | null;
  class_id: string | null;
  class_name: string | null;
}

/**
 * A visit with its session and class names. The session is the visit's own session (a row of classes). The class is the series
 * the camper is actively enrolled in for that session: the earliest-starting one when there are several. A camp-day visit has
 * no session, so no class. The outer select lets the callers filter on these names by their column names.
 */
const SELECT_CHECK_INS = `
  SELECT * FROM (
    SELECT ci.id, ci.person_id, ci.checked_in_at, ci.checked_in_by, ci.method, ci.checked_out_at, ci.checked_out_by,
           ci.collected_by_person_id, ci.override_reason, ci.note, ci.session_id, ci.session_unassigned,
           s.name AS session_name, cs.id AS class_id, cs.name AS class_name
      FROM check_ins ci
      LEFT JOIN classes s ON s.org_id = ci.org_id AND s.id = ci.session_id
      LEFT JOIN LATERAL (
        SELECT ser.id, ser.name
          FROM enrolments e
          JOIN class_series ser ON ser.org_id = e.org_id AND ser.id = e.series_id
         WHERE e.org_id = ci.org_id AND e.person_id = ci.person_id AND e.status = 'enrolled' AND ser.class_id = ci.session_id
         ORDER BY ser.series_starts_at, ser.id
         LIMIT 1
      ) cs ON true
  ) AS visit`;

export const toCheckIn = (row: CheckInRow): CheckInRecord => ({
  id: row.id,
  personId: row.person_id,
  checkedInAt: toIso(row.checked_in_at),
  checkedInBy: row.checked_in_by,
  method: row.method,
  checkedOutAt: nullableIso(row.checked_out_at),
  checkedOutBy: row.checked_out_by,
  collectedByPersonId: row.collected_by_person_id,
  overrideReason: row.override_reason,
  note: row.note,
  sessionId: row.session_id,
  sessionUnassigned: row.session_unassigned,
  sessionName: row.session_name,
  classId: row.class_id,
  className: row.class_name,
});

/** Runs a visit query. The limit, when given, is the last parameter. */
export async function queryCheckIns(
  db: Db,
  where: string,
  params: SqlParam[],
  order: string,
  limit?: number,
): Promise<CheckInRecord[]> {
  const values = limit === undefined ? params : [...params, limit];
  const limitClause = limit === undefined ? '' : `LIMIT $${values.length}`;
  const { rows } = await db.query<CheckInRow>(`${SELECT_CHECK_INS} ${where} ${order} ${limitClause}`, values);

  return rows.map(toCheckIn);
}

export async function openVisit(db: Db, personId: string): Promise<CheckInRecord | null> {
  if (!isUuid(personId)) {
    return null;
  }
  const found = await queryCheckIns(db, 'WHERE person_id = $1 AND checked_out_at IS NULL', [personId], '');

  return found[0] ?? null;
}

export async function requireCheckIn(db: Db, id: string): Promise<CheckInRecord> {
  const found = await queryCheckIns(db, 'WHERE id = $1', [id], '');
  if (!found[0]) {
    throw new NotOnSiteError();
  }

  return found[0];
}
