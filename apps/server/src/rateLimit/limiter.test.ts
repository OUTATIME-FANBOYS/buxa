import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { HttpError } from '../http/errors';
import { clientAddress, createMemoryRateLimiter, createPgRateLimiter, enforceRateLimit, howLong, rateKey, type RateRule } from './limiter';

const rule = (limit: number, windowSeconds: number): RateRule => ({ name: `test.${limit}.${windowSeconds}`, limit, windowSeconds });

describe('rate limiter (in memory)', () => {
  it('allows the first N hits, refuses hit N+1, and resets after the window', async () => {
    let now = 1_000_000;
    const limiter = createMemoryRateLimiter(() => now);
    const r = rule(10, 3600);
    for (let i = 1; i <= 10; i++) expect((await limiter.hit(r, 'user-a')).allowed).toBe(true);
    const refused = await limiter.hit(r, 'user-a');
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBe(3600);

    now += 1_800_000; // half way through: still refused, with the time left
    expect((await limiter.hit(r, 'user-a')).retryAfterSeconds).toBe(1800);
    now += 1_800_000 + 1; // past the window: the count starts again
    const after = await limiter.hit(r, 'user-a');
    expect(after).toMatchObject({ allowed: true, remaining: 9 });
  });

  it('counts each identity separately', async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    const r = rule(1, 60);
    expect((await limiter.hit(r, 'user-a')).allowed).toBe(true);
    expect((await limiter.hit(r, 'user-b')).allowed).toBe(true);
    expect((await limiter.hit(r, 'user-a')).allowed).toBe(false);
  });

  it('enforceRateLimit throws a 429 with Retry-After and a message the user can read', async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    const r = rule(1, 90);
    await enforceRateLimit(limiter, r, 'user-a');
    const error = await enforceRateLimit(limiter, r, 'user-a').catch(e => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(429);
    expect(error.retryAfterSeconds).toBe(90);
    expect(error.message).toBe('Too many requests. Try again in 2 minutes.');
  });

  it('keys are hashes: no identity appears in them', () => {
    const key = rateKey(rule(1, 1), 'person@example.com');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('example');
  });

  it('describes waits in plain words', () => {
    expect(howLong(1)).toBe('1 second');
    expect(howLong(45)).toBe('45 seconds');
    expect(howLong(89)).toBe('89 seconds');
    expect(howLong(90)).toBe('2 minutes');
    expect(howLong(3600)).toBe('60 minutes');
  });

  it('takes the client address from the last X-Forwarded-For hop, which the platform appends', () => {
    expect(clientAddress(new Headers({ 'x-forwarded-for': 'forged, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientAddress(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(clientAddress(new Headers())).toBe('unknown');
  });
});

const url = process.env.DATABASE_URL;

// The Postgres limiter counts through rate_limit_hit() and the database clock, so it must be checked against the real table.
describe.skipIf(!url)('rate limiter (Postgres, migration 0010)', () => {
  const pool = new pg.Pool({ connectionString: url });
  const limiter = createPgRateLimiter(pool);
  beforeAll(() => migrate(pool));
  afterAll(() => pool.end());

  it('hits the limit on the N+1 call and allows again after the window', async () => {
    const r = { name: `pg.test.${randomBytes(4).toString('hex')}`, limit: 3, windowSeconds: 1 };
    const identity = randomBytes(8).toString('hex');
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.hit(r, identity));
    expect(results.map(x => x.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].retryAfterSeconds).toBeGreaterThanOrEqual(1);

    await new Promise(resolve => setTimeout(resolve, 1_100));
    const after = await limiter.hit(r, identity);
    expect(after).toMatchObject({ allowed: true, remaining: 2 });
  });

  it('stores hashed keys only, with no identity in the clear', async () => {
    const identity = `visible-${randomBytes(6).toString('hex')}`;
    await limiter.hit(rule(5, 60), identity);
    const { rows } = await pool.query<{ key: string }>('SELECT key FROM rate_limits WHERE key = $1', [rateKey(rule(5, 60), identity)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).not.toContain(identity);
  });

  it('is not readable by the request role or the Data API roles', async () => {
    const { rows } = await pool.query<{ can: boolean }>(`SELECT has_table_privilege('buxa_app', 'rate_limits', 'SELECT') AS can`);
    expect(rows[0].can).toBe(false);
    const fn = await pool.query<{ can: boolean }>(`SELECT has_function_privilege('buxa_app', 'rate_limit_hit(text,integer,integer)', 'EXECUTE') AS can`);
    expect(fn.rows[0].can).toBe(true);
  });
});
