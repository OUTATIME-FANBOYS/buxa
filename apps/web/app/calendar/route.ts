import { publicRoute } from '@buxa/server/http/route';

export const dynamic = 'force-dynamic';

/**
 * The camp's iCal feed, read-only, for calendar apps: GET /calendar?token=... . The token is the only credential, so it is read
 * from the query string. The request log records only the path, so the token is never written to a log.
 * An unknown token, a malformed one and an archived camp all get the same 404.
 */
export const GET = publicRoute(async ({ request, runtime }) => {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const body = await runtime.services.calendar.feed(token, new Date());
  if (body === null) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'private, no-cache',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
});
