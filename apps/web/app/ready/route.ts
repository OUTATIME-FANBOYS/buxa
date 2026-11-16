import { publicRoute } from '@/server/http/route';

export const dynamic = 'force-dynamic';

/** Can it serve traffic? Load balancers use this to stop routing to an instance without a database. */
export const GET = publicRoute(async ({ runtime, log }) => {
  try {
    await runtime.pool.query('SELECT 1');
    return { status: 'ready' };
  } catch (err) {
    log.error({ err }, 'database not reachable');
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
});
