import { afterAll, beforeAll, describe } from 'vitest';
import { householdWithChild } from '../../holds/__tests__/holdFixture';
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
      addCamper: async familyName => {
        const personId = await fx.addPerson(fx.orgA, '2016-03-01');
        if (familyName) {
          await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
            const { rows } = await db.query<{ id: string }>(
              `INSERT INTO households (org_id, name) VALUES ($1, $2) RETURNING id`,
              [fx.orgA, familyName],
            );
            await db.query(
              `INSERT INTO household_members (org_id, household_id, person_id, relationship) VALUES ($1, $2, $3, 'child')`,
              [fx.orgA, rows[0].id, personId],
            );
          });
        }

        return personId;
      },
      addSeatHold: (classId, hold) =>
        withOrg(pool, fx.actor.userId, fx.orgA, async db => {
          const family = await householdWithChild(db, fx.orgA, hold.householdName ?? 'Contract family');
          await db.query(
            `INSERT INTO seat_holds (org_id, session_id, household_id, person_id, expires_at, released_at, release_reason)
             VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN now() END, CASE WHEN $6::boolean THEN 'cancelled' END)`,
            [fx.orgA, classId, family.householdId, family.personId, hold.expiresAt, hold.released],
          );
        }),
      close: () => fx.close(),
    };
  });
});
