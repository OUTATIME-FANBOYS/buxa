import type { Logger } from '@buxa/server/log';
import type { Runtime } from '@buxa/server/runtime';
import { loginPrivilegesOf, privilegeProblems, UNRESTRICTED_LOGIN_MESSAGE } from '@buxa/db';
import { publicRoute } from '@buxa/server/http/route';
import { RATE_RULES, clientAddress, type RateLimiter } from '@buxa/server/rateLimit/limiter';

export const dynamic = 'force-dynamic';

/** How long one database check serves every caller on this instance. */
const CACHE_MS = 5_000;

interface Body {
  status: string;
  /** Set only for a refusal, so an operator can see the fix. It never names the login or a secret. */
  message?: string;
}
interface Answer {
  status: number;
  body: Body;
  retryAfterSeconds?: number;
}
/** The database check's result per pool, kept for CACHE_MS. Rate decisions are per address and are never cached. */
const checked = new WeakMap<object, { at: number; status: number; body: Body }>();

/** Can it serve traffic? Load balancers use this to stop routing to an instance without a database. */
export const GET = publicRoute(async ({ request, runtime, log }) => {
  const now = Date.now();
  const cached = checked.get(runtime.pool);
  if (cached && now - cached.at < CACHE_MS) {
    return Response.json(cached.body, { status: cached.status });
  }

  const answer = await answerFor(request, runtime, log);
  if (answer.retryAfterSeconds === undefined) {
    checked.set(runtime.pool, { at: now, status: answer.status, body: answer.body });
  }

  return Response.json(answer.body, {
    status: answer.status,
    ...(answer.retryAfterSeconds !== undefined && { headers: { 'retry-after': String(answer.retryAfterSeconds) } }),
  });
});

async function answerFor(request: Request, runtime: Runtime, log: Logger): Promise<Answer> {
  const decision = await allowAddress(runtime.rateLimiter, clientAddress(request.headers), log);
  if (!decision.allowed) {
    return { status: 429, body: { status: 'rate_limited' }, retryAfterSeconds: decision.retryAfterSeconds };
  }
  try {
    // Production refuses to serve through a login that can bypass row-level security (see docs/security.md, section 2).
    const problems = privilegeProblems(await loginPrivilegesOf(runtime.pool));
    if (runtime.config.env === 'production' && problems.length > 0) {
      log.fatal({ problems }, 'database login is not restricted');

      return { status: 503, body: { status: 'unrestricted_login', message: UNRESTRICTED_LOGIN_MESSAGE } };
    }
    await runtime.pool.query('SELECT 1');

    return { status: 200, body: { status: 'ready' } };
  } catch (err) {
    log.error({ err }, 'database not reachable');

    return { status: 503, body: { status: 'unavailable' } };
  }
}

/** If the limiter itself cannot be reached, answer anyway: the database check below then decides, as it did before limits existed. */
async function allowAddress(
  limiter: RateLimiter,
  address: string,
  log: Logger,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  try {
    return await limiter.hit(RATE_RULES.readyByAddress, address);
  } catch (err) {
    log.warn({ err }, 'rate limit unavailable for the readiness probe');

    return { allowed: true };
  }
}
