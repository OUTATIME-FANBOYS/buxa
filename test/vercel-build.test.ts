import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations } from '../scripts/vercel-build';

describe('vercel-build script (scripts/vercel-build.ts)', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.MIGRATION_DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('skips migrations when VERCEL_ENV is not production', async () => {
    process.env.VERCEL_ENV = 'preview';
    const result = await applyMigrations();
    expect(result).toEqual([]);
  });

  it('throws an error if VERCEL_ENV is production but no migration URL is provided', async () => {
    process.env.VERCEL_ENV = 'production';
    await expect(applyMigrations()).rejects.toThrow('MIGRATION_DATABASE_URL is not set');
  });

  it('never uses the runtime DATABASE_URL to migrate', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://app:generated@127.0.0.1:1/db';
    await expect(applyMigrations()).rejects.toThrow('MIGRATION_DATABASE_URL is not set');
  });
});
