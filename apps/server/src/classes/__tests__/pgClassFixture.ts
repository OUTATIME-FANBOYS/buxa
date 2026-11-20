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
  return facts =>
    decideEnrolment(
      { ...facts, sessionDay: SESSION_DAY },
      { waitlistIfFull: false, override: null, actorCanOverride: false, ...options },
    );
}

async function insertCamp(pool: Pool, slug: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO orgs (name, slug, timezone) VALUES ('Class test camp', $1, 'Australia/Sydney') RETURNING id`,
    [slug],
  );

  return rows[0].id;
}

async function insertUser(pool: Pool, email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name) VALUES ($1, 'Class test staff') RETURNING id`,
    [email],
  );

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
  await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`, [
    orgA,
    userA,
    orgB,
    userB,
  ]);

  return {
    pool,
    repo: new PgClassRepository(pool),
    actor: { userId: userA, orgId: orgA, role: 'owner' },
    otherActor: { userId: userB, orgId: orgB, role: 'owner' },
    orgA,
    orgB,
    addPerson: (orgId, dob, givenName = 'Camper') =>
      withOrg(
        pool,
        orgId === orgB ? userB : userA,
        orgId,
        async db =>
          (
            await db.query<{ id: string }>(
              `INSERT INTO people (org_id, given_name, family_name, date_of_birth) VALUES ($1, $2, 'Test', $3::date) RETURNING id`,
              [orgId, givenName, dob],
            )
          ).rows[0].id,
      ),
    close: async () => {
      await pool.query('DELETE FROM orgs WHERE id = ANY($1::uuid[])', [[orgA, orgB]]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userA, userB]]).catch(() => undefined);
    },
  };
}

/** A session (the parent) covering July 2027. */
export function makeSession(
  repo: PgClassRepository,
  actor: Actor,
  overrides: { name?: string; startsOn?: LocalDate; endsOn?: LocalDate } = {},
) {
  return repo.createSession(actor, {
    name: overrides.name ?? 'Summer camp',
    description: 'Two weeks in July.',
    startsOn: overrides.startsOn ?? '2027-07-01',
    endsOn: overrides.endsOn ?? '2027-07-31',
  });
}

/**
 * A class's input on Monday 5 July 2027 between two camp-local hours (Sydney, UTC+10): Robotics, ages 8 to 12, camp size 5 by
 * default. Pass the overrides a test needs.
 */
export function sessionInput(
  fromHour: number,
  toHour: number,
  extra: {
    name?: string;
    capacity?: number;
    ageRange?: { minAge: number; maxAge: number };
    instructorIds?: string[];
  } = {},
) {
  const at = (h: number) => `2027-07-05T${String(h).padStart(2, '0')}:00:00+10:00`;

  return {
    name: extra.name ?? 'Robotics',
    ageRange: extra.ageRange ?? { minAge: 8, maxAge: 12 },
    capacity: extra.capacity ?? 5,
    startsAt: at(fromHour),
    endsAt: at(toHour),
    location: 'Lab 1',
    instructorIds: extra.instructorIds ?? [],
  };
}

/** A member of the camp, to read as. Found through the test's own pool, which is not row-level security limited. */
async function memberOfCamp(pool: Pool, orgId: string): Promise<string> {
  const { rows } = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM org_members WHERE org_id = $1 ORDER BY created_at LIMIT 1',
    [orgId],
  );

  return rows[0].user_id;
}

/** Reads the audit actions written in one camp, in order. */
export async function auditActions(pool: Pool, orgId: string): Promise<string[]> {
  return withOrg(pool, await memberOfCamp(pool, orgId), orgId, async db =>
    (await db.query<{ action: string }>('SELECT action FROM audit_log ORDER BY id')).rows.map(r => r.action),
  );
}

/** The data of the newest `class.create` entry in the camp. */
export async function classAuditData(pool: Pool, orgId: string): Promise<Record<string, unknown> | undefined> {
  return withOrg(
    pool,
    await memberOfCamp(pool, orgId),
    orgId,
    async db =>
      (
        await db.query<{ data: Record<string, unknown> }>(
          `SELECT data FROM audit_log WHERE action = 'class.create' ORDER BY id DESC LIMIT 1`,
        )
      ).rows[0]?.data,
  );
}
