import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';

const ok = { DATABASE_URL: 'postgres://x/y', NEXT_PUBLIC_SUPABASE_URL: 'https://a.supabase.co' };

describe('server config', () => {
  it('applies defaults and reads the shared public Supabase values', () => {
    expect(loadConfig(ok)).toEqual({
      env: 'development',
      databaseUrl: 'postgres://x/y',
      supabaseUrl: 'https://a.supabase.co',
      supabasePublishableKey: undefined,
      dbPoolMax: 10,
      logLevel: 'info',
    });
  });
  it('requires DATABASE_URL, with a message that says where to look', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL: is required \(see apps\/web\/\.env\.example\)/);
  });
  it('requires the Supabase address in production only', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x/y', NODE_ENV: 'production' })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL: is required/,
    );
    expect(loadConfig({ DATABASE_URL: 'postgres://x/y', NODE_ENV: 'test' }).supabaseUrl).toBeUndefined();
  });
  it('lists every problem and never echoes a secret', () => {
    let message = '';
    try {
      loadConfig({ DB_POOL_MAX: '999', DATABASE_URL: 'mysql://user:hunter2@h/db' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/DB_POOL_MAX/);
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain('hunter2');
  });
  it('bounds the pool size and the log level', () => {
    expect(loadConfig({ ...ok, DB_POOL_MAX: '5' }).dbPoolMax).toBe(5);
    expect(() => loadConfig({ ...ok, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});

// The migration login is for the migrate command only. The web runtime must never read it, and must never fall back to it.
describe('web runtime config and the migration login', () => {
  const migrationOnly = { MIGRATION_DATABASE_URL: 'postgres://migrator:generated@h/db' };

  it('fails when the migration URL is the only database URL set', () => {
    expect(() => loadConfig(migrationOnly)).toThrow(/DATABASE_URL: is required for the web app/);
    expect(() => loadConfig(migrationOnly)).toThrow(/never used by the web app/);
  });

  it('fails in production too, and never uses the migration URL as the runtime URL', () => {
    expect(() => loadConfig({ ...migrationOnly, NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('ignores the migration URL when the runtime URL is set, and never returns it', () => {
    const config = loadConfig({ ...ok, ...migrationOnly });
    expect(config.databaseUrl).toBe('postgres://x/y');
    expect(JSON.stringify(config)).not.toContain('generated');
  });
});
