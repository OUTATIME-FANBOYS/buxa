import type { CheckInMethod } from '@buxa/contracts';
import { isUuid } from '@buxa/domain';
import { nullableIso, toIso, type Db } from '../people/pgRows';
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
}

const SELECT_CHECK_INS = `
  SELECT id, person_id, checked_in_at, checked_in_by, method, checked_out_at, checked_out_by,
         collected_by_person_id, override_reason, note
    FROM check_ins`;

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
});

/** Runs a visit query. The limit, when given, is the last parameter. */
export async function queryCheckIns(db: Db, where: string, params: unknown[], order: string, limit?: number): Promise<CheckInRecord[]> {
  const values = limit === undefined ? params : [...params, limit];
  const limitClause = limit === undefined ? '' : `LIMIT $${values.length}`;
  const { rows } = await db.query<CheckInRow>(`${SELECT_CHECK_INS} ${where} ${order} ${limitClause}`, values);
  return rows.map(toCheckIn);
}

export async function openVisit(db: Db, personId: string): Promise<CheckInRecord | null> {
  if (!isUuid(personId)) return null;
  const found = await queryCheckIns(db, 'WHERE person_id = $1 AND checked_out_at IS NULL', [personId], '');
  return found[0] ?? null;
}

export async function requireCheckIn(db: Db, id: string): Promise<CheckInRecord> {
  const found = await queryCheckIns(db, 'WHERE id = $1', [id], '');
  if (!found[0]) throw new NotOnSiteError();
  return found[0];
}
