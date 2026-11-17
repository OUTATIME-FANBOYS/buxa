import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { decideEnrolment, type Actor, type EnrolmentOptions, type LocalDate } from '@buxa/domain';
import type { EnrolmentRule } from '../ClassRepository';
import { PgClassRepository } from '../PgClassRepository';

/** The camp day used by every Postgres class test: Monday 5 July 2027 in the camp's zone. */
export const SESSION_DAY: LocalDate = '2027-07-05';

export interface ClassFixture {
  pool: Pool;
  repo: PgClassRepository;
  /** An owner of camp A. */
  actor: Actor;
  /** An owner of camp B, a second camp. */
  otherActor: Actor;
  orgA: string;
  orgB: string;
  /** A person in the given camp. `dob` null leaves the date of birth unknown. */
  addPerson(orgId: string, dob: string | null, givenName?: string): Promise<string>;
  /** Removes both camps. Their audit rows go with them (erasure is allowed; only edits and deletes of single rows are not). */
  close(): Promise<void>;
}

/** The domain's enrolment rule, bound as the service binds it. Pass options to choose waitlisting or an override. */
export function enrolRule(options: Partial<EnrolmentOptions> = {}): EnrolmentRule {
  return facts => decideEnrolment(
    { ...facts, sessionDay: SESSION_DAY },
    { waitlistIfFull: false, override: null, actorCanOverride: false, ...options },
  );
}

async function insertCamp(pool: Pool, slug: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO orgs (name, slug, timezone) VALUES ('Class test camp', $1, 'Australia/Sydney') RETURNING id`, [slug]);

  return rows[0].id;
}

async function insertUser(pool: Pool, email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(`INSERT INTO users (email, name) VALUES ($1, 'Class test staff') RETURNING id`, [email]);

  return rows[0].id;
}

/**
 * Two camps with random slugs and one owner in each. Rows are written through the real adapter, so row-level security and the
 * audit entries are exercised exactly as in production. Cleanup is best effort.
 */
export async function createClassFixture(pool: Pool): Promise<ClassFixture> {
  const tag = randomBytes(6).toString('hex');
  const orgA = await insertCamp(pool, `classes-a-${tag}`);
  const orgB = await insertCamp(pool, `classes-b-${tag}`);
  const userA = await insertUser(pool, `owner-a-${tag}@example.test`);
  const userB = await insertUser(pool, `owner-b-${tag}@example.test`);

  return {
    pool,
    repo: new PgClassRepository(pool),
    actor: { userId: userA, orgId: orgA, role: 'owner' },
    otherActor: { userId: userB, orgId: orgB, role: 'owner' },
    orgA,
    orgB,
    addPerson: (orgId, dob, givenName = 'Camper') => withOrg(pool, orgId, async db => (await db.query<{ id: string }>(
      `INSERT INTO people (org_id, given_name, family_name, date_of_birth) VALUES ($1, $2, 'Test', $3::date) RETURNING id`,
      [orgId, givenName, dob])).rows[0].id),
    close: async () => {
      await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userA, userB]]).catch(() => undefined);
    },
  };
}

/** A class in the camp: Robotics, ages 8 to 12 by default, with the given default capacity. */
export function makeClass(repo: PgClassRepository, actor: Actor, overrides: {
  name?: string;
  capacity?: number;
  ageRange?: { minAge: number; maxAge: number };
  instructorRatio?: { instructors: number; campers: number } | null;
} = {}) {
  return repo.createClass(actor, {
    name: overrides.name ?? 'Robotics',
    description: 'Build and program small robots.',
    ageRange: overrides.ageRange ?? { minAge: 8, maxAge: 12 },
    capacity: overrides.capacity ?? 5,
    instructorRatio: overrides.instructorRatio ?? null,
  });
}

/** A session on Monday 5 July 2027 between two camp-local hours (Sydney, UTC+10). */
export function sessionInput(fromHour: number, toHour: number, extra: { capacity?: number; instructorIds?: string[] } = {}) {
  const at = (h: number) => `2027-07-05T${String(h).padStart(2, '0')}:00:00+10:00`;

  return { startsAt: at(fromHour), endsAt: at(toHour), location: 'Lab 1', instructorIds: extra.instructorIds ?? [], capacity: extra.capacity ?? 5 };
}

/** Reads the audit actions written in one camp, in order. */
export function auditActions(pool: Pool, orgId: string): Promise<string[]> {
  return withOrg(pool, orgId, async db => (await db.query<{ action: string }>('SELECT action FROM audit_log ORDER BY id')).rows.map(r => r.action));
}

/** The data of the newest `session.create` entry in the camp. */
export function sessionAuditData(pool: Pool, orgId: string): Promise<Record<string, unknown> | undefined> {
  return withOrg(pool, orgId, async db => (await db.query<{ data: Record<string, unknown> }>(
    `SELECT data FROM audit_log WHERE action = 'session.create' ORDER BY id DESC LIMIT 1`)).rows[0]?.data);
}
