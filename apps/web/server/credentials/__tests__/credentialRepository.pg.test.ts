import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { credentialRepositoryContract } from './credentialRepository.contract';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('CredentialRepository on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => { await migrate(pool); });
  afterAll(async () => { await pool.end(); });
  credentialRepositoryContract(() => createPgFixture(pool));
});
