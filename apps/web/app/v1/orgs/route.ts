import { NewOrgInputSchema } from '@buxa/contracts';
import { parseBody, readJson } from '@/server/http/parse';
import { authedRoute, created } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Start a camp; the caller becomes its owner. */
export const POST = authedRoute(async ({ request, session, runtime }) => {
  const input = parseBody(NewOrgInputSchema, await readJson(request));
  return created(await runtime.services.orgs.createCamp(session.user.id, input));
});
