import type pg from 'pg';
import type { ClassInput, ClassPriceInput } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { Outcome } from '@buxa/server/classes/outcome';
import type { Repositories } from '@buxa/server/repositories';
import type { Services } from '@buxa/server/runtime';
import { fictionalAuthId } from './camp';
import { families } from './roster';

/**
 * Sessions, classes, a teacher, enrolments and the developer's owner membership for Camp Birchwood. Everything here is keyed by a
 * stable name (a session's name, a class's name inside its session, the teacher's email), so running the seed again finds these
 * rows and creates nothing twice. Campers are found by the names the roster gives them.
 */

/** A session is a date range (camp-local days) that holds classes. Dates are in the camp's timezone, which is UTC. */
export const SESSION_PLAN = [
  {
    name: 'Summer 2027',
    description: 'Six weeks of swimming, trails and crafts for campers aged 10 to 16.',
    startsOn: '2027-07-05',
    endsOn: '2027-08-30',
    isPublic: true,
  },
  {
    name: 'Art Session',
    description: 'A short autumn session in the studio: watercolour, sketching and a showing for families.',
    startsOn: '2026-11-18',
    endsOn: '2026-11-26',
    isPublic: false,
  },
] as const;

export interface CamperRef {
  givenName: string;
  familyName: string;
}

/**
 * A class is a time range inside a session, with its own name, ages, camp size, location and price (null for none). Times are UTC
 * instants. Prices are on classes, never on sessions: each class carries its own price, and a family pays per class.
 */
export interface ClassPlan {
  session: (typeof SESSION_PLAN)[number]['name'];
  name: string;
  minAge: number;
  maxAge: number;
  capacity: number;
  location: string;
  startsAt: string;
  endsAt: string;
  price: ClassPriceInput | null;
  /** Campers enrolled, in order. A camper past the capacity is waitlisted. */
  campers: CamperRef[];
  /** The class has the teacher assigned. */
  hasTeacher: boolean;
}

export const CLASS_PLAN: readonly ClassPlan[] = [
  {
    session: 'Summer 2027',
    name: 'Swim Stars',
    minAge: 10,
    maxAge: 16,
    // Small on purpose: the third camper below is waitlisted.
    capacity: 2,
    location: 'Lake Pier',
    startsAt: '2027-07-05T09:00:00Z',
    endsAt: '2027-07-05T10:30:00Z',
    price: { currency: 'USD', regularMinor: 45000, earlyBirdMinor: 39900, earlyBirdUntil: '2027-06-30' },
    campers: [
      { givenName: 'Owen', familyName: 'Adeyemi' },
      { givenName: 'Mila', familyName: 'Adeyemi' },
      { givenName: 'Theo', familyName: 'Brandt' },
    ],
    hasTeacher: false,
  },
  {
    session: 'Summer 2027',
    name: 'Trail Explorers',
    minAge: 10,
    maxAge: 16,
    capacity: 6,
    location: 'Forest Trail',
    startsAt: '2027-07-06T13:00:00Z',
    endsAt: '2027-07-06T15:00:00Z',
    price: { currency: 'USD', regularMinor: 45000, earlyBirdMinor: null, earlyBirdUntil: null },
    campers: [
      { givenName: 'Ada', familyName: 'Castillo' },
      { givenName: 'Sana', familyName: 'Gupta' },
      { givenName: 'Jonah', familyName: 'Ibarra' },
    ],
    hasTeacher: false,
  },
  {
    session: 'Art Session',
    name: 'Watercolour Basics',
    minAge: 10,
    maxAge: 16,
    capacity: 8,
    location: 'Studio 2',
    startsAt: '2026-11-21T10:00:00Z',
    endsAt: '2026-11-21T12:00:00Z',
    price: null,
    campers: [
      { givenName: 'Eli', familyName: 'Gupta' },
      { givenName: 'Tara', familyName: 'Ibarra' },
    ],
    hasTeacher: true,
  },
];

/** The fictional teacher. The email uses the reserved .test domain, and the account cannot sign in (no identity-provider id). */
export const TEACHER_PLAN = {
  givenName: 'Tess',
  familyName: 'Harrow',
  email: 'teacher.demo@example.test',
} as const;

export interface ClassCounts {
  sessions: number;
  classes: number;
  teachers: number;
  teacherAssignments: number;
  enrolled: number;
  waitlisted: number;
}

/** What the run made, and the totals the seed's rows now add up to. Totals are the same on every run. */
export interface ClassSeedResult {
  /** The developer account made (or promoted to) owner, as the email the seed used; null when none was chosen. */
  ownerEmail: string | null;
  ownerSource: 'SEED_OWNER_EMAIL' | 'the only non-fictional account' | null;
  created: number;
  totals: ClassCounts;
}

const FICTIONAL_DOMAINS = ['example.com', 'example.test'] as const;

/** Fictional accounts use reserved domains. Anything else is a real account (or the developer's). */
export function isFictionalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1] ?? '';

  return (FICTIONAL_DOMAINS as readonly string[]).includes(domain);
}

export type DeveloperPick = { kind: 'one'; email: string } | { kind: 'none' } | { kind: 'many'; count: number };

/**
 * Without SEED_OWNER_EMAIL, the developer is the one account that is not fictional. The local schema has no sign-in time, so
 * "most recent sign-in" cannot be used. Zero or several candidates is not guessed at.
 */
export function pickDeveloperOwner(accountEmails: readonly string[]): DeveloperPick {
  const real = accountEmails.filter(email => !isFictionalEmail(email));
  if (real.length === 0) {
    return { kind: 'none' };
  }
  if (real.length > 1) {
    return { kind: 'many', count: real.length };
  }

  return { kind: 'one', email: real[0] };
}

function unwrap<T>(outcome: Outcome<T>, what: string): T {
  if (!outcome.ok) {
    throw new Error(`${what}: ${outcome.failure.message}`);
  }

  return outcome.value;
}

/** The developer account, from SEED_OWNER_EMAIL when it is set (it must have signed in once), otherwise the one real account. */
async function developerAccount(
  pool: pg.Pool,
  envEmail: string | undefined,
): Promise<{ id: string; email: string; source: 'SEED_OWNER_EMAIL' | 'the only non-fictional account' } | null> {
  if (envEmail !== undefined) {
    const { rows } = await pool.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = $1', [
      envEmail.toLowerCase(),
    ]);
    if (!rows[0]) {
      throw new Error(
        'SEED_OWNER_EMAIL names an account that has not signed in yet. Sign in once with it, then run the seed again.',
      );
    }

    return { ...rows[0], source: 'SEED_OWNER_EMAIL' };
  }
  const { rows } = await pool.query<{ id: string; email: string }>('SELECT id, email FROM users ORDER BY email');
  const pick = pickDeveloperOwner(rows.map(r => r.email));
  if (pick.kind === 'none') {
    console.log(
      'No developer account found to make owner. Sign in once, or set SEED_OWNER_EMAIL in apps/web/.env.local.',
    );

    return null;
  }
  if (pick.kind === 'many') {
    throw new Error(
      `${pick.count} real accounts exist, so the developer cannot be picked. Set SEED_OWNER_EMAIL in apps/web/.env.local.`,
    );
  }
  const found = rows.find(r => r.email === pick.email);

  return found ? { ...found, source: 'the only non-fictional account' } : null;
}

async function campersNamed(pool: pg.Pool, orgId: string, camper: CamperRef): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM people WHERE org_id = $1 AND given_name = $2 AND family_name = $3 AND archived_at IS NULL',
    [orgId, camper.givenName, camper.familyName],
  );
  if (rows.length !== 1) {
    throw new Error(`Expected one camper named ${camper.givenName} ${camper.familyName}, found ${rows.length}.`);
  }

  return rows[0].id;
}

/** A class's fields as the plan gives them, for the service (the teacher and campers are added by their own steps). */
function classInputOf(plan: ClassPlan): ClassInput {
  return {
    name: plan.name,
    ageRange: { minAge: plan.minAge, maxAge: plan.maxAge },
    capacity: plan.capacity,
    startsAt: plan.startsAt,
    endsAt: plan.endsAt,
    location: plan.location,
    instructorIds: [],
    price: plan.price,
  };
}

function samePlanPrice(a: ClassPriceInput | null, b: ClassPriceInput | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return (
    a.currency === b.currency &&
    a.regularMinor === b.regularMinor &&
    a.earlyBirdMinor === b.earlyBirdMinor &&
    a.earlyBirdUntil === b.earlyBirdUntil
  );
}

/** Saves the plan's price on a class that already exists. Returns true when it wrote a change, false when the price already matches. */
async function syncClassPrice(services: Services, owner: Actor, classId: string, plan: ClassPlan): Promise<boolean> {
  const current = unwrap(await services.classes.getClass(owner, classId), `Class ${plan.name}`);
  if (samePlanPrice(current.price, plan.price)) {
    return false;
  }
  unwrap(await services.classes.updateClass(owner, classId, classInputOf(plan)), `Price for ${plan.name}`);

  return true;
}

/** Totals for the seeded rows, so the report reads the same whether the run created them or found them. */
async function totalsOf(pool: pg.Pool, orgId: string): Promise<ClassCounts> {
  const sessionNames = SESSION_PLAN.map(s => s.name);
  const classNames = CLASS_PLAN.map(c => c.name);
  const sessions = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM classes WHERE org_id = $1 AND name = ANY($2)',
    [orgId, sessionNames],
  );
  const classes = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM sessions WHERE org_id = $1 AND name = ANY($2)',
    [orgId, classNames],
  );
  const teachers = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM org_members m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = $1 AND m.role = 'teacher' AND u.email = $2`,
    [orgId, TEACHER_PLAN.email],
  );
  const assignments = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM class_teachers ct JOIN sessions s ON s.id = ct.session_id AND s.org_id = ct.org_id
      WHERE ct.org_id = $1 AND s.name = ANY($2)`,
    [orgId, classNames],
  );
  const enrolments = await pool.query<{ status: string; n: number }>(
    `SELECT e.status, count(*)::int AS n FROM enrolments e JOIN sessions s ON s.id = e.session_id AND s.org_id = e.org_id
      WHERE e.org_id = $1 AND s.name = ANY($2) AND e.status IN ('enrolled', 'waitlisted') GROUP BY e.status`,
    [orgId, classNames],
  );
  const count = (status: string) => enrolments.rows.find(r => r.status === status)?.n ?? 0;

  return {
    sessions: sessions.rows[0].n,
    classes: classes.rows[0].n,
    teachers: teachers.rows[0].n,
    teacherAssignments: assignments.rows[0].n,
    enrolled: count('enrolled'),
    waitlisted: count('waitlisted'),
  };
}

/**
 * Adds the sessions, classes, teacher, enrolments and developer owner. Each step looks for its row first, so a second run creates
 * nothing. Writes go through the services where they exist, so the audit rows are written; the owner membership and the
 * teacher's membership are inserted directly, as the camp's other memberships are (there is no invite flow for them here).
 */
export async function seedClasses(
  pool: pg.Pool,
  repos: Repositories,
  services: Services,
  owner: Actor,
  envEmail: string | undefined,
): Promise<ClassSeedResult> {
  const orgId = owner.orgId;
  let created = 0;

  // The developer account becomes an owner of the camp, so the camp shows in its list.
  const developer = await developerAccount(pool, envEmail);
  if (developer) {
    const { rows } = await pool.query<{ role: string }>(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [orgId, developer.id],
    );
    if (rows[0]?.role !== 'owner') {
      await pool.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')
           ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner'`,
        [orgId, developer.id],
      );
      created++;
    }
  }

  const sessionIds = new Map<string, string>();
  for (const plan of SESSION_PLAN) {
    const { rows } = await pool.query<{ id: string }>('SELECT id FROM classes WHERE org_id = $1 AND name = $2', [
      orgId,
      plan.name,
    ]);
    if (rows[0]) {
      sessionIds.set(plan.name, rows[0].id);
      continue;
    }
    const session = unwrap(
      await services.classes.createSession(owner, {
        name: plan.name,
        description: plan.description,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        isPublic: plan.isPublic,
      }),
      `Session ${plan.name}`,
    );
    sessionIds.set(plan.name, session.id);
    created++;
  }

  const classIds = new Map<string, string>();
  for (const plan of CLASS_PLAN) {
    const sessionId = sessionIds.get(plan.session);
    if (!sessionId) {
      throw new Error(`No session ${plan.session} for class ${plan.name}.`);
    }
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM sessions WHERE org_id = $1 AND class_id = $2 AND name = $3',
      [orgId, sessionId, plan.name],
    );
    if (rows[0]) {
      classIds.set(plan.name, rows[0].id);
      // A class made by an earlier run may predate its price: bring it to the plan (a no-op when it already matches).
      if (await syncClassPrice(services, owner, rows[0].id, plan)) {
        created++;
      }
      continue;
    }
    const cls = unwrap(await services.classes.addClass(owner, sessionId, classInputOf(plan)), `Class ${plan.name}`);
    classIds.set(plan.name, cls.id);
    created++;
  }

  // The teacher: an account with the teacher role, assigned to the class marked hasTeacher.
  const teacher = await repos.users.upsertFromIdentity({
    authId: fictionalAuthId(TEACHER_PLAN.email),
    email: TEACHER_PLAN.email,
    name: `${TEACHER_PLAN.givenName} ${TEACHER_PLAN.familyName}`,
  });
  const membership = await pool.query<{ role: string }>(
    'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
    [orgId, teacher.id],
  );
  if (!membership.rows[0]) {
    await pool.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'teacher')`, [orgId, teacher.id]);
    created++;
  }
  for (const plan of CLASS_PLAN.filter(c => c.hasTeacher)) {
    const classId = classIds.get(plan.name);
    if (!classId) {
      throw new Error(`No class ${plan.name} to assign the teacher to.`);
    }
    const assigned = await pool.query('SELECT 1 FROM class_teachers WHERE session_id = $1 AND user_id = $2', [
      classId,
      teacher.id,
    ]);
    if (assigned.rowCount === 0) {
      unwrap(await services.classes.setTeachers(owner, classId, [teacher.id]), `Teacher for ${plan.name}`);
      created++;
    }
  }

  // Enrolments. A class is filled in order; the camper past its capacity is waitlisted.
  for (const plan of CLASS_PLAN) {
    const classId = classIds.get(plan.name);
    if (!classId) {
      throw new Error(`No class ${plan.name} to enrol into.`);
    }
    for (const camper of plan.campers) {
      const camperId = await campersNamed(pool, orgId, camper);
      const active = await pool.query(
        `SELECT 1 FROM enrolments WHERE session_id = $1 AND person_id = $2 AND status IN ('enrolled', 'waitlisted')`,
        [classId, camperId],
      );
      if (active.rowCount === 0) {
        unwrap(
          await services.classes.enrol(owner, { classId, camperId, waitlistIfFull: true }),
          `Enrolment for ${camper.givenName} in ${plan.name}`,
        );
        created++;
      }
    }
  }

  return {
    ownerEmail: developer?.email ?? null,
    ownerSource: developer?.source ?? null,
    created,
    totals: await totalsOf(pool, orgId),
  };
}

/** The roster's campers the class plan names, checked against the roster so a rename cannot silently break the seed. */
export function plannedCampersAreInRoster(): boolean {
  const named = new Set(families().flatMap(f => f.campers.map(c => `${c.givenName} ${c.familyName}`)));

  return CLASS_PLAN.every(c => c.campers.every(camper => named.has(`${camper.givenName} ${camper.familyName}`)));
}
