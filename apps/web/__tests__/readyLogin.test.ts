import { afterEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { UNRESTRICTED_LOGIN_MESSAGE } from '@buxa/db';
import { createLogger } from '@buxa/server/log';
import { createMemoryRateLimiter } from '@buxa/server/rateLimit/limiter';
import { installRuntime, type Runtime } from '@buxa/server/runtime';
import { GET as ready } from '../app/ready/route';
import { GET as health } from '../app/health/route';

// /ready is the probe that refuses a database login able to bypass row-level security in production. These tests use a fake
// pool that answers the login-attribute query, so no database is needed. The real logins are tested in packages/db.
type Privileges = { superuser: boolean; bypass_rls: boolean; member_of_privileged_role: boolean };
const LOGIN_QUERY = 'rolbypassrls';

function fakePool(privileges: Privileges | 'down') {
  const sql: string[] = [];
  const pool = {
    sql,
    query: (text: string) => {
      sql.push(text);
      if (privileges === 'down') {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432'); // a host name and address must never reach the response
      }
      if (text.includes(LOGIN_QUERY)) {
        return { rows: [privileges] };
      }

      return { rows: [{ '?column?': 1 }] };
    },
  };

  return pool;
}

function install(env: 'production' | 'development', pool: ReturnType<typeof fakePool>): void {
  installRuntime({
    config: { env },
    log: createLogger('silent'),
    pool: pool as unknown as Pool,
    rateLimiter: createMemoryRateLimiter(),
    startupCheck: Promise.resolve('ok'),
  } as unknown as Runtime);
}

const RESTRICTED: Privileges = { superuser: false, bypass_rls: false, member_of_privileged_role: false };
const BYPASS: Privileges = { superuser: false, bypass_rls: true, member_of_privileged_role: false };

afterEach(() => installRuntime(undefined));

describe('/ready and the database login', () => {
  it('answers 503 with the fix in production when the login can bypass row-level security', async () => {
    const pool = fakePool(BYPASS);
    install('production', pool);
    const r = await ready(new Request('https://buxa.test/ready'));
    expect(r.status).toBe(503);
    const body = (await r.json()) as { status: string; message: string };
    expect(body).toEqual({ status: 'unrestricted_login', message: UNRESTRICTED_LOGIN_MESSAGE });
    expect(pool.sql).not.toContain('SELECT 1'); // refused before the probe's own query
  });

  it('refuses a login that is a superuser or a member of a privileged role, too', async () => {
    install('production', fakePool({ superuser: true, bypass_rls: false, member_of_privileged_role: false }));
    expect((await ready(new Request('https://buxa.test/ready'))).status).toBe(503);
    install('production', fakePool({ superuser: false, bypass_rls: false, member_of_privileged_role: true }));
    expect((await ready(new Request('https://buxa.test/ready'))).status).toBe(503);
  });

  it('answers ready in production with a restricted login', async () => {
    install('production', fakePool(RESTRICTED));
    const r = await ready(new Request('https://buxa.test/ready'));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ready' });
  });

  it('does not refuse outside production (local development uses the superuser login)', async () => {
    install('development', fakePool(BYPASS));
    const r = await ready(new Request('https://buxa.test/ready'));
    expect(r.status).toBe(200);
  });

  it('answers unavailable, with no host or address, when the database cannot be reached', async () => {
    install('production', fakePool('down'));
    const r = await ready(new Request('https://buxa.test/ready'));
    expect(r.status).toBe(503);
    const text = await r.text();
    expect(text).toBe('{"status":"unavailable"}');
  });
});

describe('/health', () => {
  it('answers ok even when the database login is privileged or the database is down', async () => {
    install('production', fakePool(BYPASS));
    const r = health();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
  });
});
