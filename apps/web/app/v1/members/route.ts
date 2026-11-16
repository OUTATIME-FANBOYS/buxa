import { actorFor } from '@/server/auth/orgScope';
import { authedRoute } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Everyone in the camp named by the x-org-id header. */
export const GET = authedRoute(({ request, session, runtime }) => runtime.services.orgs.listMembers(actorFor(request.headers, session)));
