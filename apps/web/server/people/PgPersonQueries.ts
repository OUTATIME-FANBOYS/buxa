import { isUuid, MAX_SEARCH_RESULTS, normalizeForSearch, type CampRole } from '@buxa/domain';
import { PersonNotFoundError, type PersonFilter, type PersonRecord } from './PeopleRepository';
import { type Db, nullableIso, toIso } from './pgRows';

interface PersonRow {
  id: string;
  given_name: string;
  family_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  archived_at: Date | null;
  created_at: Date;
  roles: CampRole[];
}

/** Dates are formatted in SQL, so they never arrive as Date objects. Roles are aggregated and sorted. */
const SELECT_PEOPLE = `
  SELECT p.id, p.given_name, p.family_name, p.preferred_name, to_char(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
         p.email, p.phone, p.archived_at, p.created_at,
         COALESCE((SELECT array_agg(pr.role ORDER BY pr.role) FROM person_roles pr WHERE pr.person_id = p.id), '{}') AS roles
    FROM people p`;
const ORDER_PEOPLE = 'ORDER BY lower(p.family_name), lower(p.given_name), p.id';

const toRecord = (row: PersonRow): PersonRecord => ({
  id: row.id,
  givenName: row.given_name,
  familyName: row.family_name,
  preferredName: row.preferred_name,
  dateOfBirth: row.date_of_birth,
  email: row.email,
  phone: row.phone,
  roles: row.roles,
  archivedAt: nullableIso(row.archived_at),
  createdAt: toIso(row.created_at),
});

/** Runs a people query. The limit is the last parameter, so it never sits in the SQL text. */
async function queryPeople(db: Db, where: string, params: unknown[], limit?: number): Promise<PersonRecord[]> {
  const values = limit === undefined ? params : [...params, limit];
  const limitClause = limit === undefined ? '' : `LIMIT $${values.length}`;
  const { rows } = await db.query<PersonRow>(`${SELECT_PEOPLE} ${where} ${ORDER_PEOPLE} ${limitClause}`, values);
  return rows.map(toRecord);
}

export async function getPerson(db: Db, id: string): Promise<PersonRecord | null> {
  if (!isUuid(id)) return null;
  const found = await queryPeople(db, 'WHERE p.id = $1', [id]);
  return found[0] ?? null;
}

export async function requirePerson(db: Db, id: string): Promise<PersonRecord> {
  const person = await getPerson(db, id);
  if (!person) throw new PersonNotFoundError();
  return person;
}

export async function personExists(db: Db, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { rowCount } = await db.query('SELECT 1 FROM people WHERE id = $1', [id]);
  return rowCount === 1;
}

export function getPeople(db: Db, ids: readonly string[]): Promise<PersonRecord[]> {
  const valid = ids.filter(isUuid);
  if (valid.length === 0) return Promise.resolve([]);
  return queryPeople(db, 'WHERE p.id = ANY($1::uuid[])', [valid]);
}

export function listPeople(db: Db, filter: PersonFilter): Promise<PersonRecord[]> {
  return queryPeople(
    db,
    `WHERE ($1::text IS NULL OR EXISTS (SELECT 1 FROM person_roles x WHERE x.person_id = p.id AND x.role = $1::text))
       AND ($2::boolean OR p.archived_at IS NULL)`,
    [filter.role ?? null, filter.includeArchived === true],
  );
}

/** Every word must appear in the joined given, family and preferred name (accent-insensitive, as matchesName does). */
export function searchPeople(db: Db, query: string, limit: number): Promise<PersonRecord[]> {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  const max = Math.min(Math.max(0, Math.floor(limit)), MAX_SEARCH_RESULTS);
  if (words.length === 0 || max === 0) return Promise.resolve([]);
  return queryPeople(
    db,
    `WHERE p.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM unnest($1::text[]) AS w(word)
          WHERE strpos(unaccent(lower(concat_ws(' ', p.given_name, p.family_name, p.preferred_name))), w.word) = 0)`,
    [words],
    max,
  );
}
