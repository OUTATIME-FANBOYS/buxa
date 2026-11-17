import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '@buxa/server/__tests__/fakes';
import { call, startRuntime } from './harness';
import { createTestIdentityProvider } from '@buxa/server/__tests__/tokens';
import { createMemoryRateLimiter, RATE_RULES, type RateDecision, type RateLimiter } from '@buxa/server/rateLimit/limiter';
import { GET as ready } from '../../app/ready/route';

const idp = await createTestIdentityProvider();
let env: ReturnType<typeof startRuntime> | undefined;
afterEach(async () => {
  await env?.stop(); env = undefined; vi.restoreAllMocks();
});

/** A limiter that refuses everything: the client must see a 429 and no work may happen. */
const refusing: RateLimiter = { async hit(): Promise<RateDecision> {
  return { allowed: false, remaining: 0, retryAfterSeconds: 42 };
} };

describe('POST /v1/orgs is rate limited per person', () => {
  it('lets the limit many camps through, refuses the next one with 429 and Retry-After, and does not write it', async () => {
    const store = new InMemoryStore();
    env = startRuntime({ repositories: store.asRepositories(), verifier: idp.verifier, rateLimiter: createMemoryRateLimiter() });
    const token = await idp.token();
    const { limit } = RATE_RULES.createCamp;
    for (let i = 1; i <= limit; i++) {
      const made = await call('POST', '/v1/orgs', { token, body: { name: `Camp ${i}`, slug: `camp-${i}` } });
      expect(made.status).toBe(201);
    }
    const refused = await call('POST', '/v1/orgs', { token, body: { name: 'One too many', slug: 'one-too-many' } });
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toMatch(/^\d+$/);
    expect((await refused.json()).error).toMatchObject({ code: 'rate_limited' });
    expect(store.orgs.size).toBe(limit);
  });

  it('counts a second person separately', async () => {
    env = startRuntime({ repositories: new InMemoryStore().asRepositories(), verifier: idp.verifier, rateLimiter: refusing });
    const token = await idp.token();
    expect((await call('POST', '/v1/orgs', { token, body: { name: 'Blocked', slug: 'blocked' } })).status).toBe(429);
  });
});

describe('/ready', () => {
  it('answers from a recent check without querying the database again', async () => {
    env = startRuntime({ verifier: idp.verifier, rateLimiter: createMemoryRateLimiter() });
    const query = vi.spyOn(env.runtime.pool, 'query').mockResolvedValue({ rows: [] } as never);
    expect((await ready(new Request('http://localhost/ready'))).status).toBe(200);
    expect((await ready(new Request('http://localhost/ready'))).status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('is limited per client address, with Retry-After, and the refusal is not cached for others', async () => {
    env = startRuntime({ verifier: idp.verifier, rateLimiter: refusing });
    const query = vi.spyOn(env.runtime.pool, 'query').mockResolvedValue({ rows: [] } as never);
    const r = await ready(new Request('http://localhost/ready', { headers: { 'x-forwarded-for': '203.0.113.7' } }));
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('42');
    expect(await r.json()).toEqual({ status: 'rate_limited' });
    expect(query).not.toHaveBeenCalled();
  });

  it('answers 503 when the limiter and the database are both unreachable, without leaking details', async () => {
    const broken: RateLimiter = { async hit() {
      throw new Error('connection refused 10.0.0.5');
    } };
    env = startRuntime({ verifier: idp.verifier, rateLimiter: broken });
    const r = await ready(new Request('http://localhost/ready'));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ status: 'unavailable' });
  });
});
