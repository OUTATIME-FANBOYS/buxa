import type { EmergencyContactRecord, NewPersonRecord, PersonPatchRecord } from './PeopleRepository';
import type { Db, SqlParam } from './pgRows';

async function insertRoles(db: Db, orgId: string, personId: string, roles: readonly string[]): Promise<void> {
  if (roles.length === 0) {
    return;
  }
  await db.query('INSERT INTO person_roles (org_id, person_id, role) SELECT $1, $2, unnest($3::text[])', [
    orgId,
    personId,
    roles,
  ]);
}

export async function insertPerson(db: Db, orgId: string, input: NewPersonRecord): Promise<string> {
  const contact = input.emergencyContact;
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO people (org_id, given_name, family_name, date_of_birth, email, phone,
                         emergency_contact_name, emergency_contact_phone, emergency_contact_relationship)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      orgId,
      input.givenName,
      input.familyName,
      input.dateOfBirth,
      input.email,
      input.phone,
      contact?.name ?? null,
      contact?.phone ?? null,
      contact?.relationship ?? null,
    ],
  );
  const id = rows[0].id;
  await insertRoles(db, orgId, id, input.roles);

  return id;
}

/** Replaces the emergency contact on one person. `null` clears all three columns. */
export async function writeEmergencyContact(db: Db, id: string, contact: EmergencyContactRecord | null): Promise<void> {
  await db.query(
    `UPDATE people SET emergency_contact_name = $2, emergency_contact_phone = $3, emergency_contact_relationship = $4
      WHERE id = $1`,
    [id, contact?.name ?? null, contact?.phone ?? null, contact?.relationship ?? null],
  );
}

/** Changes only the fields present in the patch. Returns their names in a fixed order (the audit entry lists them). */
export async function updatePerson(db: Db, orgId: string, id: string, patch: PersonPatchRecord): Promise<string[]> {
  const sets: string[] = [];
  const values: SqlParam[] = [];
  const changed: string[] = [];
  const set = (name: string, column: string, value: SqlParam): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
    changed.push(name);
  };
  if (patch.givenName !== undefined) {
    set('givenName', 'given_name', patch.givenName);
  }
  if (patch.familyName !== undefined) {
    set('familyName', 'family_name', patch.familyName);
  }
  if (patch.dateOfBirth !== undefined) {
    set('dateOfBirth', 'date_of_birth', patch.dateOfBirth);
  }
  if (patch.email !== undefined) {
    set('email', 'email', patch.email);
  }
  if (patch.phone !== undefined) {
    set('phone', 'phone', patch.phone);
  }
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
