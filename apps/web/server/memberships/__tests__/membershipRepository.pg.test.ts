import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { membershipRepositoryContract } from './membershipRepository.contract';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('MembershipRepository on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => { await migrate(pool); });
  afterAll(async () => { await pool.end(); });
  membershipRepositoryContract(() => createPgFixture(pool));
});
