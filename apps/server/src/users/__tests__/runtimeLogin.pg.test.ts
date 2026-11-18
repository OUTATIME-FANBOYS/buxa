import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { PgUserRepository } from '../PgUserRepository';
import { PgOrgRepository } from '../../orgs/PgOrgRepository';

const url = process.env.DATABASE_URL;

// Audit S-06, end to end. docs/deploy.md asks the operator for a runtime login that is a member of buxa_app and has
// neither BYPASSRLS nor CREATEROLE. This test makes such a login and runs the real sign-in and organisation repositories
// through it. The privileged login is only used to create the test login and to drop it again.
describe.skipIf(!url)('runtime login without row-level-security bypass (S-06)', () => {
  const admin = new pg.Pool({ connectionString: url });
  const tag = randomBytes(4).toString('hex');
  const role = `buxa_rt_${tag}`; // alphanumeric and lowercase, so it is safe to quote as an identifier below
  const password = randomBytes(16).toString('hex');
  let runtime: pg.Pool;

  beforeAll(async () => {
    await migrate(admin);
    await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);
    await admin.query(`GRANT buxa_app TO "${role}"`);
    const runtimeUrl = new URL(url!);
    runtimeUrl.username = role;
    runtimeUrl.password = password;
    runtime = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 });
  });

  afterAll(async () => {
    await runtime?.end();
    await admin.query(`DROP ROLE IF EXISTS "${role}"`).catch(() => undefined);
    await admin.end();
  });

  it('the runtime login has no bypass and no CREATEROLE', async () => {
    const r = await admin.query('SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = $1', [role]);
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  });

  it('the runtime login cannot read the migration history, and sees no tenant rows without a role switch', async () => {
    await expect(runtime.query('SELECT name FROM schema_migrations')).rejects.toThrow(/permission denied/);
    // Row-level security hides every row from a role that no policy names, so the answer is empty, not an error.
    expect((await runtime.query('SELECT id FROM orgs')).rowCount).toBe(0);
  });

  it('signs a user in, creates a camp, and lists memberships, all through the runtime login', async () => {
    const users = new PgUserRepository(runtime);
    const orgs = new PgOrgRepository(runtime);
    const authId = randomUUID();
    const email = `runtime-${tag}@privs.test`;

    const user = await users.upsertFromIdentity({ authId, email, name: 'Runtime Owner' });
    expect(typeof user.id).toBe('string');
    expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name']);
    expect(user).toMatchObject({ email, name: 'Runtime Owner' });
    // The same provider id updates the row rather than creating a second one.
    const again = await users.upsertFromIdentity({ authId, email, name: 'Runtime Owner' });
    expect(again.id).toBe(user.id);

    expect(await users.membershipsOf(user.id)).toEqual([]);
    const org = await orgs.createWithOwner({ name: `Runtime camp ${tag}`, slug: `runtime-camp-${tag}`, timezone: 'UTC' }, user.id);
    expect(org).toMatchObject({ name: `Runtime camp ${tag}`, slug: `runtime-camp-${tag}`, role: 'owner' });

    expect(await users.membershipsOf(user.id)).toEqual([
      { orgId: org.id, role: 'owner', name: `Runtime camp ${tag}`, slug: `runtime-camp-${tag}` },
    ]);
    // Reading the camp is tenant-scoped, so it works through withOrg.
    expect((await orgs.get(org.id)).slug).toBe(`runtime-camp-${tag}`);
  });

  it('a second camp is hidden from the first one, even though the runtime login created both', async () => {
    const users = new PgUserRepository(runtime);
    const orgs = new PgOrgRepository(runtime);
    const owner = await users.upsertFromIdentity({ authId: randomUUID(), email: `other-${tag}@privs.test`, name: 'Other Owner' });
    const other = await orgs.createWithOwner({ name: `Other camp ${tag}`, slug: `other-camp-${tag}`, timezone: 'UTC' }, owner.id);
    const first = await orgs.createWithOwner({ name: `First camp ${tag}`, slug: `first-camp-${tag}`, timezone: 'UTC' }, owner.id);

    const seenFromFirst = await withOrg(runtime, first.id, db => db.query<{ id: string }>('SELECT id FROM orgs'));
    expect(seenFromFirst.rows.map(r => r.id)).toEqual([first.id]);
    expect(seenFromFirst.rows.map(r => r.id)).not.toContain(other.id);
  });
});
