import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { tooManyRequests } from '../http/errors';
import { settle } from '@buxa/domain';

/**
 * Fixed-window rate limits. Every limit is a rule (its name, how many hits, how long the window is) applied to one identity: a
 * user id or a client address. The Postgres limiter keeps its counts in the database, so every serverless instance shares them.
 */
export interface RateRule { readonly name: string; readonly limit: number; readonly windowSeconds: number }
export interface RateDecision { allowed: boolean; remaining: number; retryAfterSeconds: number }
export interface RateLimiter { hit(rule: RateRule, identity: string): Promise<RateDecision> }

/** The limits the app uses. They are documented in docs/security.md (section 2): change both together. */
export const RATE_RULES = {
  /** Starting a camp, from the API or the sign-in form. One budget per person, shared by both paths. */
  createCamp: { name: 'camp.create', limit: 10, windowSeconds: 3600 },
  /** Badge scans by one staff member. A busy gate scans a person every few seconds, so this allows a scan every half second. */
  scanCode: { name: 'attendance.scan', limit: 120, windowSeconds: 60 },
  /** The readiness probe, per client address. It only counts when the cached check has expired (see app/ready/route.ts). */
  readyByAddress: { name: 'ready.address', limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateRule>;

/** The table key: a hash, so no user id or address is stored in the clear. */
export const rateKey = (rule: RateRule, identity: string): string =>
  createHash('sha256').update(`${rule.name}\u0000${identity}`).digest('hex');

/** Counts hits in the `rate_limits` table through rate_limit_hit() (migration 0010). The database clock decides the window. */
export function createPgRateLimiter(pool: Pool): RateLimiter {
  return {
    async hit(rule, identity) {
      const { rows } = await pool.query<{ allowed: boolean; remaining: number; retry_after_seconds: number }>(
        'SELECT allowed, remaining, retry_after_seconds FROM rate_limit_hit($1, $2, $3)',
        [rateKey(rule, identity), rule.limit, rule.windowSeconds],
      );
      const row = rows[0];

      return { allowed: row.allowed, remaining: row.remaining, retryAfterSeconds: row.retry_after_seconds };
    },
  };
}

/** The same rules held in this process's memory. For tests, and for code that runs without a database. Not shared between instances. */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    hit(rule, identity) {
      return settle(() => {
        const key = rateKey(rule, identity);
        const time = now();
        const span = rule.windowSeconds * 1000;
        const previous = windows.get(key);
        const current = previous && time - previous.start < span ? previous : { start: time, count: 0 };
        current.count += 1;
        windows.set(key, current);
        const retryAfterSeconds = Math.max(Math.ceil((current.start + span - time) / 1000), 1);

        return { allowed: current.count <= rule.limit, remaining: Math.max(rule.limit - current.count, 0), retryAfterSeconds };
      });
    },
  };
}

/** Throws a 429 the client can show when the rule is used up. Call it before the work it guards. */
export async function enforceRateLimit(limiter: RateLimiter, rule: RateRule, identity: string): Promise<void> {
  const decision = await limiter.hit(rule, identity);
  if (decision.allowed) {
    return;
  }
  throw tooManyRequests(decision.retryAfterSeconds, `Too many requests. Try again in ${howLong(decision.retryAfterSeconds)}.`);
}

/** A short, user-facing wait: seconds below a minute and a half, then whole minutes. */
export function howLong(seconds: number): string {
  if (seconds < 90) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(seconds / 60);

  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * The client address for per-address limits. On Vercel the platform appends the caller's address to X-Forwarded-For, so the last
 * entry is the one a client cannot forge. (The first entry is whatever the client sent.)
 */
export function clientAddress(headers: Headers): string {
  const hops = (headers.get('x-forwarded-for') ?? '').split(',').map(h => h.trim()).filter(Boolean);

  return (hops.at(-1) ?? headers.get('x-real-ip') ?? 'unknown').slice(0, 64);
}
