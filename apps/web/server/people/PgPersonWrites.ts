import type { NewPersonRecord, PersonPatchRecord } from './PeopleRepository';
import type { Db } from './pgRows';

async function insertRoles(db: Db, orgId: string, personId: string, roles: readonly string[]): Promise<void> {
  if (roles.length === 0) return;
  await db.query('INSERT INTO person_roles (org_id, person_id, role) SELECT $1, $2, unnest($3::text[])', [orgId, personId, roles]);
}

export async function insertPerson(db: Db, orgId: string, input: NewPersonRecord): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO people (org_id, given_name, family_name, preferred_name, date_of_birth, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [orgId, input.givenName, input.familyName, input.preferredName, input.dateOfBirth, input.email, input.phone]);
  const id = rows[0].id;
  await insertRoles(db, orgId, id, input.roles);
  return id;
}

/** Changes only the fields present in the patch. Returns their names in a fixed order (the audit entry lists them). */
export async function updatePerson(db: Db, orgId: string, id: string, patch: PersonPatchRecord): Promise<string[]> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const changed: string[] = [];
  const set = (name: string, column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
    changed.push(name);
  };
  if (patch.givenName !== undefined) set('givenName', 'given_name', patch.givenName);
  if (patch.familyName !== undefined) set('familyName', 'family_name', patch.familyName);
  if (patch.preferredName !== undefined) set('preferredName', 'preferred_name', patch.preferredName);
  if (patch.dateOfBirth !== undefined) set('dateOfBirth', 'date_of_birth', patch.dateOfBirth);
  if (patch.email !== undefined) set('email', 'email', patch.email);
  if (patch.phone !== undefined) set('phone', 'phone', patch.phone);
  if (sets.length > 0) {
    values.push(id);
    await db.query(`UPDATE people SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  }
  if (patch.roles !== undefined) {
    await db.query('DELETE FROM person_roles WHERE person_id = $1', [id]);
    await insertRoles(db, orgId, id, patch.roles);
    changed.push('roles');
  }
  return changed;
}
