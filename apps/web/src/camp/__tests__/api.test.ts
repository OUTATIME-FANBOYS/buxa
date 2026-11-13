import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const make = (impl: (url: string, init: RequestInit) => Promise<Response>, extra = {}) => {
  const f = vi.fn(impl as never);
  return { f, api: createApi({ getToken: async () => 'tok-1', fetch: f as unknown as typeof fetch, ...extra }) };
};
const hdr = (f: ReturnType<typeof vi.fn>, i = 0) => (f.mock.calls[i][1] as RequestInit).headers as Record<string, string>;

describe('api client', () => {
  it('sends the bearer token and no org header for /me', async () => {
    const { f, api } = make(async () => json(200, { user: { id: 'u' }, orgs: [] }));
    await api.me();
    expect(f.mock.calls[0][0]).toBe('/v1/me');
    expect(hdr(f).authorization).toBe('Bearer tok-1');
    expect(hdr(f)['x-org-id']).toBeUndefined();
  });
  it('sends x-org-id for organisation routes', async () => {
    const { f, api } = make(async () => json(200, { members: [] }));
    await api.members('org-9');
    expect(hdr(f)['x-org-id']).toBe('org-9');
  });
  it('posts JSON bodies', async () => {
    const { f, api } = make(async () => json(201, { id: 'o1' }));
    await api.createOrg('Camp', 'camp-x');
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST'); expect(hdr(f)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Camp', slug: 'camp-x' });
  });
  it('does not call the server without a token', async () => {
    const f = vi.fn();
    const api = createApi({ getToken: async () => null, fetch: f as unknown as typeof fetch });
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(f).not.toHaveBeenCalled();
  });
  it('retries once with a refreshed token after a 401', async () => {
    let n = 0;
    const refresh = vi.fn(async () => 'tok-2');
    const { f, api } = make(async () => (++n === 1 ? json(401, { error: { code: 'unauthorized', message: 'x' } }) : json(200, { user: {}, orgs: [] })), { refreshToken: refresh });
    await api.me();
    expect(f).toHaveBeenCalledTimes(2); expect(hdr(f, 1).authorization).toBe('Bearer tok-2'); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('gives up after one retry (no loop)', async () => {
    const refresh = vi.fn(async () => 'tok-2');
    const { f, api } = make(async () => json(401, { error: { code: 'unauthorized', message: 'Invalid or expired token' } }), { refreshToken: refresh });
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('maps the standard error shape', async () => {
    const { api } = make(async () => json(409, { error: { code: 'conflict', message: 'That address is already taken', requestId: 'r-1' } }));
    const e = await api.createOrg('a', 'b').catch(x => x) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.message, e.requestId]).toEqual([409, 'conflict', 'That address is already taken', 'r-1']);
  });
  it('turns a non-JSON server error into a friendly message', async () => {
    const { api } = make(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    const e = await api.me().catch(x => x) as ApiError;
    expect(e.status).toBe(502); expect(e.message).not.toMatch(/html/i);
  });
  it('reports an unreachable server as a network error', async () => {
    const { api } = make(async () => { throw new TypeError('Failed to fetch'); });
    await expect(api.me()).rejects.toMatchObject({ status: 0, code: 'network' });
  });
});
