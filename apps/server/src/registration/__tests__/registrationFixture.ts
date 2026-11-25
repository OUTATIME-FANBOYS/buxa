import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor, Role } from '@buxa/domain';
import { createPgRepositories } from '../../repositories';
import { createPeopleService } from '../../services/people/createPeopleService';
import type { PeopleService } from '../../services/people/PeopleService';
import { systemClock } from '../../services/clock';

/*
 * A camp with one session (a date range) and four classes, two children, and a household for each child. Used by the Postgres
 * registration tests. Every row is written under the camp's own row-level security (withOrg), so the fixture behaves like the app.
 * The names carry a random tag, so runs never collide.
 */

export interface RegistrationFixture {
  orgId: string;
  userId: string;
  sessionId: string;
  /** The classes (rows of `sessions`). ARCHERY and SWIMMING overlap; PAINTING is the one-place class; CLIMBING is on another day. */
  classes: { archery: string; swimming: string; painting: string; climbing: string };
  /** Two children, each in their own household, with a guardian. */
  children: { ada: string; ben: string };
  actor(role: Role): Actor;
}

/**
 * The people service a registration reads, on Postgres: the same service the app wires, so the child and the guardian are read from
 * the rows the fixture wrote. The fixture's guardians have no phone, so a registration that names one saves it to the household.
 */
export function pgPeopleService(pool: pg.Pool): PeopleService {
  const repos = createPgRepositories(pool);

  return createPeopleService({
    people: repos.people,
    memberships: repos.memberships,
    credentials: repos.credentials,
    attendance: repos.attendance,
    classes: repos.classes,
    orgs: repos.orgs,
    clock: systemClock,
  });
}

export async function createRegistrationFixture(
  pool: pg.Pool,
  tag = randomBytes(6).toString('hex'),
): Promise<RegistrationFixture> {
  const users = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name) VALUES ($1, 'Reg test') RETURNING id`,
    [`reg-${tag}@reg.test`],
  );
  const userId = users.rows[0].id;
  const orgs = await pool.query<{ id: string }>(`INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id`, [
    `Reg ${tag}`,
    `reg-classes-${tag}`,
  ]);
  const orgId = orgs.rows[0].id;
  await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')`, [orgId, userId]);

  return withOrg(pool, userId, orgId, async db => {
    const parent = await db.query<{ id: string }>(
      `INSERT INTO classes (org_id, name, starts_on, ends_on) VALUES ($1, $2, DATE '2027-07-10', DATE '2027-07-12') RETURNING id`,
      [orgId, `Session ${tag}`],
    );
    const sessionId = parent.rows[0].id;
    const classRow = async (name: string, startsAt: string, endsAt: string, capacity: number): Promise<string> => {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO sessions (org_id, class_id, name, starts_at, ends_at, location, capacity, ratio_campers, ratio_instructors)
         VALUES ($1, $2, $3, $4, $5, 'Field', $6, 8, 1) RETURNING id`,
        [orgId, sessionId, name, startsAt, endsAt, capacity],
      );

      return rows[0].id;
    };
    const archery = await classRow('Archery', '2027-07-10T10:00:00Z', '2027-07-10T11:00:00Z', 2);
    const swimming = await classRow('Swimming', '2027-07-10T10:30:00Z', '2027-07-10T11:30:00Z', 2);
    const painting = await classRow('Painting', '2027-07-10T13:00:00Z', '2027-07-10T14:00:00Z', 1);
    const climbing = await classRow('Climbing', '2027-07-11T10:00:00Z', '2027-07-11T11:00:00Z', 10);

    const child = async (given: string, family: string, dob: string): Promise<string> => {
      const guardian = await db.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name) VALUES ($1, 'Guardian', $2) RETURNING id`,
        [orgId, `${given} family ${tag}`],
      );
      const household = await db.query<{ id: string }>(
        `INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`,
        [orgId, `${given} household ${tag}`],
      );
      await db.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship, is_guardian) VALUES ($1, $2, $3, 'Parent', true)`,
        [orgId, household.rows[0].id, guardian.rows[0].id],
      );
      const camper = await db.query<{ id: string }>(
        `INSERT INTO people (org_id, given_name, family_name, date_of_birth) VALUES ($1, $2, $3, $4) RETURNING id`,
        [orgId, given, family, dob],
      );
      await db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [
        orgId,
        camper.rows[0].id,
      ]);
      await db.query(
        `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'Child')`,
        [orgId, household.rows[0].id, camper.rows[0].id],
      );

      return camper.rows[0].id;
    };

    return {
      orgId,
      userId,
      sessionId,
      classes: { archery, swimming, painting, climbing },
      children: { ada: await child('Ada', 'Lovelace', '2014-03-09'), ben: await child('Ben', 'Carrow', '2013-05-01') },
      actor: (role: Role): Actor => ({ userId, orgId, role }),
    };
  });
}
