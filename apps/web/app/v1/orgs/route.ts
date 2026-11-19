import { NewOrgInputSchema } from '@buxa/contracts';
import { parseBody, readJson } from '@buxa/server/http/parse';
import { authedRoute, created } from '@buxa/server/http/route';
import { RATE_RULES, enforceRateLimit } from '@buxa/server/rateLimit/limiter';

export const dynamic = 'force-dynamic';

/** Start a camp; the caller becomes its owner. Limited per person (RATE_RULES.createCamp). */
export const POST = authedRoute(async ({ request, session, runtime }) => {
  await enforceRateLimit(runtime.rateLimiter, RATE_RULES.createCamp, session.user.id);
  const input = parseBody(NewOrgInputSchema, await readJson(request));

  return created(await runtime.services.orgs.createCamp(session.user.id, input));
});
