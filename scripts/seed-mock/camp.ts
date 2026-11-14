import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { Actor, Role } from '@buxa/domain';
import type { Repositories } from '../../apps/web/server/repositories';
import type { Services } from '../../apps/web/server/runtime';
import { CAMP, STAFF_ACCOUNTS } from './roster';

/**
 * Camp-level setup. The seed uses the privileged pool for three things the app has no path for, because they happen outside a
 * signed-in request: finding the camp by its slug (row-level security hides a camp from anyone not in it), adding the
 * fictional staff accounts as members (phase 1 has no invite flow), and clearing a camp's rows on --reset. Creating the camp
 * and the accounts still goes through the services and repositories, so the audit rows the app writes are written here too.
 */

export interface AccountChoice { owner?: string; admin?: string; staff?: string; viewer?: string }

export interface CampRef { orgId: string; actors: Record<'owner' | 'staff', Actor> }

/** The camp's id if it already exists. */
export async function findCampId(pool: pg.Pool): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM orgs WHERE slug = $1', [CAMP.slug]);
  return rows[0]?.id ?? null;
}

/**
 * A stable UUID for a fictional account, so a re-run finds the same user. It is not a real identity-provider id, so nobody can
 * sign in as these accounts.
 */
export function fictionalAuthId(email: string): string {
  const hex = createHash('sha256').update(`buxa-mock-seed:${email}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** An account the operator named by email (it must have signed in once), or a fictional one the seed creates. */
async function accountFor(pool: pg.Pool, repos: Repositories, email: string | undefined, fictional: { name: string; email: string }): Promise<string> {
  if (email === undefined) {
    const user = await repos.users.upsertFromIdentity({ authId: fictionalAuthId(fictional.email), email: fictional.email, name: fictional.name });
    return user.id;
  }
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!rows[0]) throw new Error(`No account for ${email} yet. Sign in once with that account, then run the seed again.`);
  return rows[0].id;
}

/** Creates the camp through the service (so `org.create` is audited) and adds the other members. */
export async function createCamp(pool: pg.Pool, services: Services, repos: Repositories, choice: AccountChoice): Promise<string> {
  const ownerId = await accountFor(pool, repos, choice.owner, STAFF_ACCOUNTS.owner);
  const camp = await services.orgs.createCamp(ownerId, { name: CAMP.name, slug: CAMP.slug, timezone: CAMP.timezone });
  const others: [Role, string | undefined, { name: string; email: string }][] = [
    ['admin', choice.admin, STAFF_ACCOUNTS.admin],
    ['staff', choice.staff, STAFF_ACCOUNTS.staff],
    ['viewer', choice.viewer, STAFF_ACCOUNTS.viewer],
  ];
  for (const [role, email, fictional] of others) {
    const userId = await accountFor(pool, repos, email, fictional);
    // Direct insert: phase 1 has no invite flow, so membership is added here, outside any request. Not audited.
    await pool.query('INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [camp.id, userId, role]);
  }
  return camp.id;
}

/** The actors the seed acts as, read from the camp's members. */
export async function actorsFor(pool: pg.Pool, orgId: string): Promise<CampRef['actors']> {
  const { rows } = await pool.query<{ user_id: string; role: 'owner' | 'staff' }>(
    `SELECT user_id, role FROM org_members WHERE org_id = $1 AND role IN ('owner', 'staff')`, [orgId]);
  const find = (role: 'owner' | 'staff'): Actor => {
    const row = rows.find(r => r.role === role);
    if (!row) throw new Error(`The camp has no ${role}.`);
    return { userId: row.user_id, orgId, role };
  };
  return { owner: find('owner'), staff: find('staff') };
}

/**
 * Clears the camp's people, households, memberships, badges and check-ins (cascading from people and households). The camp
 * row, its members and its audit history stay: the audit log is append-only by design, and the slug stays stable.
 */
export async function resetCamp(pool: pg.Pool, orgId: string): Promise<void> {
  await pool.query('DELETE FROM people WHERE org_id = $1', [orgId]);
  await pool.query('DELETE FROM households WHERE org_id = $1', [orgId]);
}
