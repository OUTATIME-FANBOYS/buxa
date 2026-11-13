import { beforeEach, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { CreatedOrgSchema, ErrorBodySchema, MeSchema, MembersSchema, OrgSchema } from '@buxa/contracts';
import { buildApp } from '../src/app';
import { InMemoryStore } from './fakes';
import { createTestIdentityProvider } from './tokens';

// These run the real routes, auth hook and permission checks against the in-memory adapter: no database needed.
const idp = await createTestIdentityProvider();
const unusedPool = new pg.Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/none' }); // /ready is not exercised here

describe('routes (in-memory repositories)', () => {
  let store: InMemoryStore;
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => {
    store = new InMemoryStore();
    app = buildApp({ config: { LOG_LEVEL: 'silent', NODE_ENV: 'test' }, pool: unusedPool, verifier: idp.verifier, repositories: store.asRepositories() });
  });
  const call = (t: string | null, o: { method?: string; url: string; org?: string; payload?: unknown }) =>
    app.inject({ method: (o.method ?? 'GET') as 'GET', url: o.url, payload: o.payload as object, headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), ...(o.org ? { 'x-org-id': o.org } : {}) } });
  const makeOrg = async (t: string, slug = 'sunrise-lake') => (await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'Sunrise Lake', slug } })).json().id as string;

  it('every success response matches its published contract', async () => {
    const t = await idp.token(); const org = await makeOrg(t);
    expect(MeSchema.parse((await call(t, { url: '/v1/me' })).json()).orgs).toHaveLength(1);
    expect(OrgSchema.parse((await call(t, { url: '/v1/org', org })).json()).memberCount).toBe(1);
    expect(MembersSchema.parse((await call(t, { url: '/v1/members', org })).json()).members).toHaveLength(1);
    const made = await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'Second', slug: 'second-camp' } });
    expect(made.statusCode).toBe(201); CreatedOrgSchema.parse(made.json());
  });

  it('every error response matches the error contract', async () => {
    const t = await idp.token();
    for (const r of [await call(null, { url: '/v1/me' }), await call(t, { url: '/v1/org' }), await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: '', slug: 'x' } })])
      ErrorBodySchema.parse(r.json());
  });

  it('refuses a bad body before anything is stored, naming the field', async () => {
    const t = await idp.token();
    const r = await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'Camp', slug: 'Not A Slug' } });
    expect(r.statusCode).toBe(400); expect(r.json().error.message).toMatch(/^slug:/);
    expect(store.orgs.size).toBe(0);
  });

  it('maps a taken address to 409', async () => {
    const t = await idp.token(); await makeOrg(t);
    expect((await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'Again', slug: 'sunrise-lake' } })).statusCode).toBe(409);
  });

  it('stops a viewer before the repository is reached', async () => {
    const owner = await idp.token(); const org = await makeOrg(owner);
    const viewer = await idp.token(); await call(viewer, { url: '/v1/me' });
    const viewerId = [...store.users.values()].find(u => u.email !== [...store.users.values()][0].email)!.id;
    store.members.push({ orgId: org, userId: viewerId, role: 'viewer' });
    const rename = vi.spyOn(store, 'rename');
    const r = await call(viewer, { method: 'PATCH', url: '/v1/org', org, payload: { name: 'Hacked' } });
    expect(r.statusCode).toBe(403); expect(rename).not.toHaveBeenCalled();
    expect(store.audit.filter(a => a.action === 'org.update')).toEqual([]);
  });

  it('never reaches the repository for someone outside the organisation', async () => {
    const owner = await idp.token(); const org = await makeOrg(owner);
    const outsider = await idp.token();
    const get = vi.spyOn(store, 'get');
    expect((await call(outsider, { url: '/v1/org', org })).statusCode).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it('never touches the repositories without a valid token', async () => {
    const upsert = vi.spyOn(store, 'upsertFromIdentity');
    expect((await call('garbage', { url: '/v1/me' })).statusCode).toBe(401);
    expect((await call(await idp.token({ signWith: idp.strangerKey }), { url: '/v1/me' })).statusCode).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('turns an unexpected repository failure into a generic 500', async () => {
    const t = await idp.token(); const org = await makeOrg(t);
    vi.spyOn(store, 'get').mockRejectedValue(new Error('connection to db-internal-7 lost'));
    const r = await call(t, { url: '/v1/org', org });
    expect(r.statusCode).toBe(500); expect(r.body).not.toContain('db-internal-7');
  });

  it('a different identity cannot claim an existing email', async () => {
    const email = 'shared@camp.test';
    expect((await call(await idp.token({ email }), { url: '/v1/me' })).statusCode).toBe(200);
    expect((await call(await idp.token({ email }), { url: '/v1/me' })).statusCode).toBe(409);
  });
});
