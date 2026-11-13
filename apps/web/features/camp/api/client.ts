import type { ZodType } from 'zod';
import { CreatedOrgSchema, MeSchema, MembersSchema, OrgSchema, OrgSummarySchema, type CreatedOrg, type Me, type Members, type Org, type OrgSummary } from '@buxa/contracts';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly requestId?: string) { super(message); this.name = 'ApiError'; }
}

export interface Api {
  me(): Promise<Me>;
  createOrg(name: string, slug: string): Promise<CreatedOrg>;
  org(orgId: string): Promise<Org>;
  renameOrg(orgId: string, name: string): Promise<OrgSummary>;
  members(orgId: string): Promise<Members>;
}

export interface ApiOptions {
  getToken: () => Promise<string | null>;
  /** Called once after a 401 to get a fresh token; return null to give up. */
  refreshToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
  base?: string;
}

interface Call { method: string; body?: unknown; orgId?: string }

const NETWORK_MESSAGE = 'Cannot reach the Buxa server. Check that it is running, then try again.';
const UNEXPECTED_MESSAGE = 'The server sent an unexpected response. Please try again.';

/** A typed client for the Buxa API. Same-origin by default (the dev server and production proxy forward /v1). Every response is validated against its contract. */
export function createApi(options: ApiOptions): Api {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = options.base ?? '';

  const send = (token: string, path: string, call: Call) => doFetch(base + path, {
    method: call.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(call.orgId ? { 'x-org-id': call.orgId } : {}),
      ...(call.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
  });

  /** One request, with at most one retry after a refreshed token (never a loop). Network failures become ApiError(0). */
  async function sendWithRetry(path: string, call: Call): Promise<Response> {
    const token = await options.getToken();
    if (!token) throw new ApiError(401, 'unauthorized', 'Sign in required');
    try {
      const first = await send(token, path, call);
      if (first.status !== 401 || !options.refreshToken) return first;
      const fresh = await options.refreshToken();
      return fresh ? await send(fresh, path, call) : first;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, 'network', NETWORK_MESSAGE);
    }
  }

  async function request<T>(path: string, schema: ZodType<T>, call: Partial<Call> = {}): Promise<T> {
    const response = await sendWithRetry(path, { method: 'GET', ...call });
    const json: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new ApiError(502, 'bad_response', UNEXPECTED_MESSAGE);
      return parsed.data;
    }
    throw toApiError(response.status, json);
  }

  return {
    me: () => request('/v1/me', MeSchema),
    createOrg: (name, slug) => request('/v1/orgs', CreatedOrgSchema, { method: 'POST', body: { name, slug } }),
    org: orgId => request('/v1/org', OrgSchema, { orgId }),
    renameOrg: (orgId, name) => request('/v1/org', OrgSummarySchema, { method: 'PATCH', orgId, body: { name } }),
    members: orgId => request('/v1/members', MembersSchema, { orgId }),
  };
}

function toApiError(status: number, body: unknown): ApiError {
  const detail = (body as { error?: { code?: unknown; message?: unknown; requestId?: unknown } } | null)?.error;
  const code = typeof detail?.code === 'string' ? detail.code : status >= 500 ? 'internal' : 'bad_request';
  const message = typeof detail?.message === 'string' ? detail.message : 'Something went wrong. Please try again.';
  return new ApiError(status, code, message, typeof detail?.requestId === 'string' ? detail.requestId : undefined);
}
