import { isUuid } from '@buxa/domain';
import type { Db } from '../people/pgRows';
import { nullableIso } from '../people/pgRows';
import { MembershipNotFoundError, type MembershipRecord } from './MembershipRepository';

interface MembershipRow {
  id: string;
  person_id: string;
  plan: string;
  starts_on: string;
  ends_on: string;
  revoked_at: Date | null;
  revoked_reason: string | null;
}

/** Dates are formatted in SQL, so they arrive as YYYY-MM-DD strings. */
const SELECT_MEMBERSHIPS = `
  SELECT id, person_id, plan, to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on,
         revoked_at, revoked_reason
    FROM memberships`;

const toRecord = (row: MembershipRow): MembershipRecord => ({
  id: row.id,
  personId: row.person_id,
  plan: row.plan,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  revokedAt: nullableIso(row.revoked_at),
  revokedReason: row.revoked_reason,
});

export async function queryMemberships(db: Db, where: string, params: unknown[]): Promise<MembershipRecord[]> {
  const { rows } = await db.query<MembershipRow>(`${SELECT_MEMBERSHIPS} ${where} ORDER BY starts_on, id`, params);
  return rows.map(toRecord);
}

export async function getMembership(db: Db, id: string): Promise<MembershipRecord | null> {
  if (!isUuid(id)) return null;
  const found = await queryMemberships(db, 'WHERE id = $1', [id]);
  return found[0] ?? null;
}

export async function requireMembership(db: Db, id: string): Promise<MembershipRecord> {
  const membership = await getMembership(db, id);
  if (!membership) throw new MembershipNotFoundError();
  return membership;
}
