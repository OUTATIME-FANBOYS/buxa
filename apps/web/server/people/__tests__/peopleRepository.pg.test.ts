import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createPgFixture } from './pgFixture';
import { peopleRepositoryContract } from './peopleRepository.contract';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('PeopleRepository on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => { await migrate(pool); });
  afterAll(async () => { await pool.end(); });
  peopleRepositoryContract(() => createPgFixture(pool));
});
