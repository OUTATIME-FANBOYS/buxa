import { checkCronSecret } from '@buxa/server/holds/cronAuth';
import { getRuntime } from '@buxa/server/runtime';

export const dynamic = 'force-dynamic';

/**
 * Scheduled job: releases the expired seat holds in every camp and promotes the waitlists. Expired holds already stop counting, so
 * this only tidies the table. Called by Vercel Cron with the CRON_SECRET bearer token (see docs/deploy.md).
 */
export async function GET(request: Request): Promise<Response> {
  const runtime = getRuntime();
  const check = checkCronSecret(request.headers.get('authorization'), runtime.config.cronSecret);
  if (!check.ok) {
    return Response.json({ error: check.message }, { status: check.status });
  }
  const sweep = await runtime.services.seatHolds.releaseExpiredHoldsEverywhere();

  return Response.json(sweep);
}
