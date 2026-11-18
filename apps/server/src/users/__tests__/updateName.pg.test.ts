import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgUserRepository } from '../PgUserRepository';

const url = process.env.DATABASE_URL;

// The saved profile name goes through buxa_set_user_name (migration 0017), sign-in must keep it, and the first and last name
// are kept in step with the full name by the users_sync_names trigger.
describe.skipIf(!url)('PgUserRepository names and clock format', () => {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const repo = new PgUserRepository(pool);
  const tag = randomBytes(4).toString('hex');
  const authId = randomUUID();
  const email = `profile-${tag}@example.test`;
  let userId: string;

  beforeAll(async () => {
    await migrate(pool);
    userId = (await repo.upsertFromIdentity({ authId, email, name: 'Testuser1' })).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('splits a new person’s name on the first space when they first sign in', async () => {
    const created = await repo.upsertFromIdentity({
      authId: randomUUID(),
      email: `split-${tag}@example.test`,
      name: 'Ana Maria Lopez',
    });
    expect(created).toMatchObject({ firstName: 'Ana', lastName: 'Maria Lopez', name: 'Ana Maria Lopez', clockFormat: null });
  });

  it('a single-word name has a first name and no last name', async () => {
    const created = await repo.upsertFromIdentity({ authId: randomUUID(), email: `one-${tag}@example.test`, name: 'Mononym' });
    expect(created).toMatchObject({ firstName: 'Mononym', lastName: null, name: 'Mononym' });
  });

  it('saves the first and last name to the account, and the full name is rebuilt from them', async () => {
    const saved = await repo.updateName(userId, { firstName: 'Test', lastName: 'User' });
    expect(saved).toEqual({
      id: userId,
      email,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      clockFormat: null,
    });
  });

  it('a saved last name can be cleared, and the full name becomes the first name', async () => {
    const saved = await repo.updateName(userId, { firstName: 'Test', lastName: null });
    expect(saved).toMatchObject({ firstName: 'Test', lastName: null, name: 'Test' });
    await repo.updateName(userId, { firstName: 'Test', lastName: 'User' });
  });

  it('keeps the saved name when the person signs in again with a different provider name', async () => {
    const again = await repo.upsertFromIdentity({ authId, email, name: 'Testuser1' });
    expect(again).toMatchObject({ name: 'Test User', firstName: 'Test', lastName: 'User' });
  });

  it('a change to the full name alone (a camp rename) splits the first and last name again', async () => {
    // The pool's login owns the table, so this stands in for buxa_rename_member, which the trigger treats the same way.
    await pool.query('UPDATE users SET name = $2 WHERE id = $1', [userId, 'Rosa Delgado']);
    const again = await repo.upsertFromIdentity({ authId, email, name: 'Testuser1' });
    expect(again).toMatchObject({ firstName: 'Rosa', lastName: 'Delgado', name: 'Rosa Delgado' });
    await repo.updateName(userId, { firstName: 'Test', lastName: 'User' });
  });

  it('saves the 12-hour clock and reads it back on sign-in', async () => {
    const saved = await repo.setClockFormat(userId, '12h');
    expect(saved.clockFormat).toBe('12h');
    expect((await repo.upsertFromIdentity({ authId, email, name: 'Testuser1' })).clockFormat).toBe('12h');
  });

  it('saves the 24-hour clock over the 12-hour one', async () => {
    expect((await repo.setClockFormat(userId, '24h')).clockFormat).toBe('24h');
  });

  it('refuses to rename a user who does not exist', async () => {
    await expect(repo.updateName(randomUUID(), { firstName: 'Nobody', lastName: null })).rejects.toThrow('no user to rename');
  });

  it('refuses to set the clock of a user who does not exist', async () => {
    await expect(repo.setClockFormat(randomUUID(), '12h')).rejects.toThrow('no user to update');
  });

  it('refuses a clock format other than 12h or 24h', async () => {
    await expect(repo.setClockFormat(userId, '36h' as '12h')).rejects.toThrow();
  });
});
