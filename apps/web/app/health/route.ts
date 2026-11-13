export const dynamic = 'force-dynamic';

/** Is the process up? Does not touch the database or the configuration, so a database outage does not restart a healthy server. */
export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
