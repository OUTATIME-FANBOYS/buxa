import { OrgPatchInputSchema } from '@buxa/contracts';
import { actorFor } from '@/server/auth/orgScope';
import { parseBody, readJson } from '@/server/http/parse';
import { authedRoute } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** The camp named by the x-org-id header. */
export const GET = authedRoute(({ request, session, runtime }) => runtime.services.orgs.getCamp(actorFor(request.headers, session)));

/** Rename it. */
export const PATCH = authedRoute(async ({ request, session, runtime }) =>
  runtime.services.orgs.renameCamp(actorFor(request.headers, session), parseBody(OrgPatchInputSchema, await readJson(request))));
