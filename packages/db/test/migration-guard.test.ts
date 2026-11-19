import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrationDatabaseUrl } from '../src/migrate';

const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');

// Runs the real migrate command with the given environment and reports how it ended. The URLs are fake: a refusal must
// happen before any connection is attempted, so nothing here can reach a database.
const runMigrate = (env: Record<string, string>) =>
  new Promise<{ code: number | null; stderr: string }>(resolve => {
    execFile(
      process.execPath,
      ['--import', 'tsx', cli],
      { env: { PATH: process.env.PATH ?? '', ...env }, timeout: 60_000 },
      (error, _stdout, stderr) => resolve({ code: error ? ((error as { code?: number }).code ?? 1) : 0, stderr }),
    );
  });

describe('migration login guard', () => {
  it('returns the migration URL when it is set', () => {
    expect(migrationDatabaseUrl({ MIGRATION_DATABASE_URL: '  postgres://m@h/db  ' })).toBe('postgres://m@h/db');
  });

  it('refuses when it is not set, even if DATABASE_URL is set (no fallback to the runtime login)', () => {
    expect(() => migrationDatabaseUrl({ DATABASE_URL: 'postgres://app@h/db' })).toThrow(
      /MIGRATION_DATABASE_URL is not set/,
    );
  });

  it('refuses a blank migration URL', () => {
    expect(() => migrationDatabaseUrl({ MIGRATION_DATABASE_URL: '   ' })).toThrow(/MIGRATION_DATABASE_URL is not set/);
  });

  it('the migrate command exits with an error and says why when only DATABASE_URL is set', async () => {
    const r = await runMigrate({ DATABASE_URL: 'postgres://app:secret@127.0.0.1:1/db' });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('MIGRATION_DATABASE_URL is not set');
    expect(r.stderr).not.toContain('secret');
  });

  it('the migrate command exits with an error when nothing is set', async () => {
    const r = await runMigrate({});
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('MIGRATION_DATABASE_URL is not set');
  });
});
