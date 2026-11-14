import { isUuid } from '@buxa/domain';
import { HouseholdNotFoundError, type HouseholdLinkRecord, type HouseholdMemberRecord, type HouseholdRecord } from './PeopleRepository';
import type { Db } from './pgRows';

interface HouseholdRow { id: string; name: string }
interface MemberRow { person_id: string; relationship: string; is_guardian: boolean; can_pickup: boolean }

async function membersOf(db: Db, householdId: string): Promise<HouseholdMemberRecord[]> {
  const { rows } = await db.query<MemberRow>(
    'SELECT person_id, relationship, is_guardian, can_pickup FROM household_members WHERE household_id = $1 ORDER BY person_id',
    [householdId]);
  return rows.map(r => ({ personId: r.person_id, relationship: r.relationship, isGuardian: r.is_guardian, canPickup: r.can_pickup }));
}

async function withMembers(db: Db, row: HouseholdRow): Promise<HouseholdRecord> {
  return { id: row.id, name: row.name, members: await membersOf(db, row.id) };
}

export async function getHousehold(db: Db, id: string): Promise<HouseholdRecord | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<HouseholdRow>('SELECT id, name FROM households WHERE id = $1', [id]);
  const row = rows[0];
  return row ? withMembers(db, row) : null;
}

export async function requireHousehold(db: Db, id: string): Promise<HouseholdRecord> {
  const household = await getHousehold(db, id);
  if (!household) throw new HouseholdNotFoundError();
  return household;
}

export async function householdsOf(db: Db, personId: string): Promise<HouseholdRecord[]> {
  if (!isUuid(personId)) return [];
  const { rows } = await db.query<HouseholdRow>(
    `SELECT h.id, h.name FROM households h
      WHERE EXISTS (SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.person_id = $1)
      ORDER BY h.name, h.id`,
    [personId]);
  const result: HouseholdRecord[] = [];
  for (const row of rows) result.push(await withMembers(db, row));
  return result;
}

export async function insertHousehold(db: Db, orgId: string, name: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>('INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id', [orgId, name]);
  return rows[0].id;
}

export async function upsertMember(db: Db, orgId: string, link: HouseholdLinkRecord): Promise<void> {
  await db.query(
    `INSERT INTO household_members (org_id, household_id, person_id, relationship, is_guardian, can_pickup)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (household_id, person_id) DO UPDATE
       SET relationship = EXCLUDED.relationship, is_guardian = EXCLUDED.is_guardian, can_pickup = EXCLUDED.can_pickup`,
    [orgId, link.householdId, link.personId, link.relationship, link.isGuardian, link.canPickup]);
}

/** True when a link was removed. */
export async function deleteMember(db: Db, householdId: string, personId: string): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM household_members WHERE household_id = $1 AND person_id = $2', [householdId, personId]);
  return rowCount === 1;
}
