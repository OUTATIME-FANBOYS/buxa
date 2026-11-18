import { GET as health } from '../../app/health/route';
import { GET as ready } from '../../app/ready/route';
import { GET as me } from '../../app/v1/me/route';
import { GET as members } from '../../app/v1/members/route';
import { GET as getOrg, PATCH as patchOrg } from '../../app/v1/org/route';
import { POST as createOrg } from '../../app/v1/orgs/route';

export { BASE_ENV, startRuntime } from '@buxa/server/__tests__/runtimeHarness';

type Handler = (request: Request) => Response | Promise<Response>;

/** Every route, addressed the way a client would: method and path. */
const ROUTES: Record<string, Handler> = {
  'GET /health': health,
  'GET /ready': ready,
  'GET /v1/me': me,
  'POST /v1/orgs': createOrg,
  'GET /v1/org': getOrg,
  'PATCH /v1/org': patchOrg,
  'GET /v1/members': members,
};

export interface CallOptions {
  token?: string | null;
  org?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
}

/** Calls a route handler with a real Web `Request`, exactly as Next.js would, and returns its `Response`. */
export async function call(method: string, path: string, options: CallOptions = {}): Promise<Response> {
  const handler = ROUTES[`${method} ${path.split('?')[0]}`];
  if (!handler) {
    throw new Error(`No route for ${method} ${path}`);
  }
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }
  if (options.org) {
    headers['x-org-id'] = options.org;
  }
  const body = options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  return handler(new Request(`http://localhost${path}`, { method, headers, body }));
}
