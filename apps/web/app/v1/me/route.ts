import type { Me } from '@buxa/contracts';
import { authedRoute } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Who is signed in and which camps they belong to. */
export const GET = authedRoute(async ({ session }): Promise<Me> => ({ user: session.user, orgs: [...session.memberships] }));
