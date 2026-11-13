import type { Role } from '@buxa/domain';

export interface User { id: string; email: string; name: string }
export interface Membership { orgId: string; role: Role; name: string; slug: string }
export interface Me { user: User; orgs: Membership[] }
export interface Org { id: string; name: string; slug: string; created_at: string }
export interface Member { id: string; name: string; email: string; role: Role }

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly requestId?: string) { super(message); this.name = 'ApiError'; }
}

export interface Api {
  me(): Promise<Me>;
  createOrg(name: string, slug: string): Promise<Membership & { id: string }>;
  org(orgId: string): Promise<Org>;
  renameOrg(orgId: string, name: string): Promise<{ id: string; name: string; slug: string }>;
  members(orgId: string): Promise<{ members: Member[] }>;
}

export interface ApiOptions {
  getToken: () => Promise<string | null>;
  /** Called once after a 401 to get a fresh token; return null to give up. */
  refreshToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
  base?: string;
}

/** A small typed client for the Buxa API. Same-origin by default (the dev server and production proxy forward /v1). */
export function createApi(o: ApiOptions): Api {
  const doFetch = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const base = o.base ?? '';

  async function send(token: string, path: string, init: { method: string; body?: unknown; orgId?: string }) {
    return doFetch(base + path, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.orgId ? { 'x-org-id': init.orgId } : {}),
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  }

  async function request<T>(path: string, init: { method?: string; body?: unknown; orgId?: string } = {}): Promise<T> {
    const call = { method: init.method ?? 'GET', body: init.body, orgId: init.orgId };
    let token = await o.getToken();
    if (!token) throw new ApiError(401, 'unauthorized', 'Sign in required');
    let res: Response;
    try {
      res = await send(token, path, call);
      if (res.status === 401 && o.refreshToken) {
        const fresh = await o.refreshToken();
        if (fresh) { token = fresh; res = await send(token, path, call); } // one retry, never a loop
      }
    } catch {
      throw new ApiError(0, 'network', 'Cannot reach the Buxa server. Check that it is running, then try again.');
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    if (res.ok) return json as T;
    const e = (json as { error?: { code?: string; message?: string; requestId?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? (res.status >= 500 ? 'internal' : 'bad_request'), e?.message ?? 'Something went wrong. Please try again.', e?.requestId);
  }

  return {
    me: () => request('/v1/me'),
    createOrg: (name, slug) => request('/v1/orgs', { method: 'POST', body: { name, slug } }),
    org: orgId => request('/v1/org', { orgId }),
    renameOrg: (orgId, name) => request('/v1/org', { method: 'PATCH', orgId, body: { name } }),
    members: orgId => request('/v1/members', { orgId }),
  };
}
