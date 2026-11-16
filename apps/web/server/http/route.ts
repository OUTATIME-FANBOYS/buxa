import 'server-only';
import { AUTH_CHALLENGE, authenticate } from '../auth/authenticate';
import type { Session } from '../auth/session';
import type { Logger } from '../log';
import { getRuntime, type Runtime } from '../runtime';
import { HttpError, errorBody, isHttpError } from './errors';
import { generateRequestId } from './requestId';

const MAX_BODY_BYTES = 1_048_576;

export interface ApiContext { request: Request; requestId: string; log: Logger; runtime: Runtime }
export interface AuthedContext extends ApiContext { session: Session }
/** A handler returns data (sent as 200 JSON) or a ready-made Response when it needs another status. */
type Reply = Response | object;
export type RouteFunction = (request: Request) => Promise<Response>;

export const created = (body: object): Response => Response.json(body, { status: 201 });

/** The one error shape every response uses. Expected failures show their message; anything else is a generic 500 and is logged. */
function failure(error: unknown, requestId: string, log: Logger): Response {
  if (isHttpError(error)) {
    const response = Response.json(errorBody(error.statusCode, error.message, requestId), { status: error.statusCode });
    if (error.statusCode === 401) response.headers.set('www-authenticate', AUTH_CHALLENGE);
    return response;
  }
  log.error({ err: error }, 'unhandled error'); // never leak internals to the client
  return Response.json(errorBody(500, 'Something went wrong', requestId), { status: 500 });
}

function finish(response: Response, requestId: string): Response {
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-content-type-options', 'nosniff');
  if (!response.headers.has('cache-control')) response.headers.set('cache-control', 'no-store'); // API answers are per person
  return response;
}

async function run(request: Request, work: (base: ApiContext) => Promise<Reply>): Promise<Response> {
  const requestId = generateRequestId(request.headers);
  const started = performance.now();
  let runtime: Runtime;
  try { runtime = getRuntime(); }
  catch (error) { // configuration is invalid: say so in the server log, tell the client nothing
    console.error(error instanceof Error ? error.message : error);
    return finish(Response.json(errorBody(500, 'Something went wrong', requestId), { status: 500 }), requestId);
  }
  const log = runtime.log.child({ reqId: requestId });

  let response: Response;
  try {
    if ((await runtime.startupCheck) === 'refuse') throw new HttpError(503, 'Service unavailable');
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    const reply = await work({ request, requestId, log, runtime });
    response = reply instanceof Response ? reply : Response.json(reply);
  } catch (error) {
    response = failure(error, requestId, log);
  }
  finish(response, requestId);
  // Path only: query strings can carry tokens, so they are never logged.
  log.info({ method: request.method, path: new URL(request.url).pathname, status: response.status, ms: Math.round(performance.now() - started) }, 'request completed');
  return response;
}

/** A route anyone may call. */
export const publicRoute = (handler: (ctx: ApiContext) => Promise<Reply>): RouteFunction => request => run(request, handler);

/** A route that needs a signed-in person. `ctx.session` is always set. */
export const authedRoute = (handler: (ctx: AuthedContext) => Promise<Reply>): RouteFunction =>
  request => run(request, async base => handler({ ...base, session: await authenticate(base.request.headers, { verifier: base.runtime.verifier, users: base.runtime.repositories.users }, base.log) }));
