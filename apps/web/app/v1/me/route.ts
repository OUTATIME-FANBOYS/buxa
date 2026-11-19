import type { Me } from '@buxa/contracts';
import { authedRoute } from '@buxa/server/http/route';
import { settle } from '@buxa/domain';

export const dynamic = 'force-dynamic';

/** Who is signed in and which camps they belong to. */
export const GET = authedRoute(({ session }): Promise<Me> =>
  settle(() => ({ user: session.user, orgs: [...session.memberships] })),
);
