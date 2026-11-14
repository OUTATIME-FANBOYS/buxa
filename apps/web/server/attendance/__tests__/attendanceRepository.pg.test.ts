import { afterAll, beforeAll, describe } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { attendanceRepositoryContract } from './attendanceRepository.contract';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('AttendanceRepository on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => { await migrate(pool); });
  afterAll(async () => { await pool.end(); });
  attendanceRepositoryContract(() => createPgFixture(pool));
});
