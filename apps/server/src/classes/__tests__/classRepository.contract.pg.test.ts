import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { createClassFixture } from './pgClassFixture';
import { classRepositoryContract, type ClassContractFixture } from './classRepository.contract';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('ClassRepository contract on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  classRepositoryContract(async (): Promise<ClassContractFixture> => {
    const fx = await createClassFixture(pool);

    return {
      repo: fx.repo,
      actor: fx.actor,
      addCamper: () => fx.addPerson(fx.orgA, '2016-03-01'),
      addSeatHold: (classId, hold) =>
        withOrg(pool, fx.actor.userId, fx.orgA, async db => {
          const { rows } = await db.query<{ id: string }>(
            `INSERT INTO households (org_id, name) VALUES ($1, 'Contract family') RETURNING id`,
            [fx.orgA],
          );
          await db.query(
            `INSERT INTO seat_holds (org_id, session_id, household_id, expires_at, released_at, release_reason)
             VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END, CASE WHEN $5::boolean THEN 'cancelled' END)`,
            [fx.orgA, classId, rows[0].id, hold.expiresAt, hold.released],
          );
        }),
      close: () => fx.close(),
    };
  });
});
