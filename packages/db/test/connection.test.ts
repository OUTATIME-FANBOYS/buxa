import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { poolConfigFor } from '../src/connection';
import { SUPABASE_ROOT_CA_2021 } from '../src/supabaseRootCa';

const certFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'certs', 'supabase-root-2021-ca.crt');

describe('database connection TLS', () => {
  it('keeps the Supabase root CA constant equal to the certificate file', () => {
    expect(SUPABASE_ROOT_CA_2021.trim()).toBe(readFileSync(certFile, 'utf8').trim());
  });

  it('uses no TLS for a local database', () => {
    expect(poolConfigFor('postgres://buxa:buxa@localhost:5433/buxa').ssl).toBe(false);
    expect(poolConfigFor('postgres://u:p@127.0.0.1:5432/x').ssl).toBe(false);
  });

  it('checks a remote database against the Supabase root CA, and removes sslmode from the URL', () => {
    const config = poolConfigFor('postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require');
    expect(config.ssl).toEqual({ ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true });
    expect(String(config.connectionString)).not.toContain('sslmode');
  });

  it('keeps the pool settings it is given', () => {
    const config = poolConfigFor('postgres://u:p@localhost:5432/x', { max: 3, connectionTimeoutMillis: 5000 });
    expect(config).toMatchObject({ max: 3, connectionTimeoutMillis: 5000 });
  });
});
