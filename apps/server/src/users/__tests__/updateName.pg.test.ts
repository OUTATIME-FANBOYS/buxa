import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgUserRepository } from '../PgUserRepository';

const url = process.env.DATABASE_URL;

// The saved profile name goes through buxa_set_user_name (migration 0015), and sign-in must keep it.
describe.skipIf(!url)('PgUserRepository.updateName', () => {
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

  it('saves the name to the account and returns the user', async () => {
    const saved = await repo.updateName(userId, 'Test User');
    expect(saved).toEqual({ id: userId, email, name: 'Test User' });
  });

  it('keeps the saved name when the person signs in again with a different provider name', async () => {
    const again = await repo.upsertFromIdentity({ authId, email, name: 'Testuser1' });
    expect(again.name).toBe('Test User');
  });

  it('refuses to rename a user who does not exist', async () => {
    await expect(repo.updateName(randomUUID(), 'Nobody')).rejects.toThrow('no user to rename');
  });
});
