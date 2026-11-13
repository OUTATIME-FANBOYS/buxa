import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatedOrgSchema, ErrorBodySchema, MeSchema, MembersSchema, OrgSchema } from '@buxa/contracts';
import { InMemoryStore } from './fakes';
import { call, startRuntime } from './harness';
import { createTestIdentityProvider } from './tokens';

// The real route handlers, auth and permission checks, against the in-memory adapter: no database needed.
const idp = await createTestIdentityProvider();

describe('routes (in-memory repositories)', () => {
  let store: InMemoryStore;
  let env: ReturnType<typeof startRuntime>;
  beforeEach(() => { store = new InMemoryStore(); env = startRuntime({ repositories: store.asRepositories(), verifier: idp.verifier }); });
  afterEach(() => env.stop());

  const makeOrg = async (token: string, slug = 'sunrise-lake') => (await (await call('POST', '/v1/orgs', { token, body: { name: 'Sunrise Lake', slug } })).json()).id as string;

  it('every success response matches its published contract', async () => {
    const t = await idp.token(); const org = await makeOrg(t);
    expect(MeSchema.parse(await (await call('GET', '/v1/me', { token: t })).json()).orgs).toHaveLength(1);
    expect(OrgSchema.parse(await (await call('GET', '/v1/org', { token: t, org })).json()).memberCount).toBe(1);
    expect(MembersSchema.parse(await (await call('GET', '/v1/members', { token: t, org })).json()).members).toHaveLength(1);
    const made = await call('POST', '/v1/orgs', { token: t, body: { name: 'Second', slug: 'second-camp' } });
    expect(made.status).toBe(201); CreatedOrgSchema.parse(await made.json());
  });

  it('every error response matches the error contract', async () => {
    const t = await idp.token();
    for (const r of [await call('GET', '/v1/me'), await call('GET', '/v1/org', { token: t }), await call('POST', '/v1/orgs', { token: t, body: { name: '', slug: 'x' } })])
      ErrorBodySchema.parse(await r.json());
  });

  it('refuses a bad body before anything is stored, naming the field', async () => {
    const r = await call('POST', '/v1/orgs', { token: await idp.token(), body: { name: 'Camp', slug: 'Not A Slug' } });
    expect(r.status).toBe(400); expect((await r.json()).error.message).toMatch(/^slug:/);
    expect(store.orgs.size).toBe(0);
  });

  it('refuses a body that is not JSON', async () => {
    const r = await call('POST', '/v1/orgs', { token: await idp.token(), rawBody: '{bad' });
    expect(r.status).toBe(400); expect((await r.json()).error.message).toMatch(/JSON/);
  });

  it('maps a taken address to 409', async () => {
    const t = await idp.token(); await makeOrg(t);
    expect((await call('POST', '/v1/orgs', { token: t, body: { name: 'Again', slug: 'sunrise-lake' } })).status).toBe(409);
  });

  it('stops a viewer before the repository is reached', async () => {
    const owner = await idp.token(); const org = await makeOrg(owner);
    const viewer = await idp.token(); await call('GET', '/v1/me', { token: viewer });
    const viewerId = [...store.users.values()].find(u => u.email !== [...store.users.values()][0].email)!.id;
    store.members.push({ orgId: org, userId: viewerId, role: 'viewer' });
    const rename = vi.spyOn(store, 'rename');
    const r = await call('PATCH', '/v1/org', { token: viewer, org, body: { name: 'Hacked' } });
    expect(r.status).toBe(403); expect(rename).not.toHaveBeenCalled();
    expect(store.audit.filter(a => a.action === 'org.update')).toEqual([]);
  });

  it('never reaches the repository for someone outside the organisation', async () => {
    const org = await makeOrg(await idp.token());
    const get = vi.spyOn(store, 'get');
    expect((await call('GET', '/v1/org', { token: await idp.token(), org })).status).toBe(403);
    expect(get).not.toHaveBeenCalled();
  });

  it('never touches the repositories without a valid token', async () => {
    const upsert = vi.spyOn(store, 'upsertFromIdentity');
    expect((await call('GET', '/v1/me', { token: 'garbage' })).status).toBe(401);
    expect((await call('GET', '/v1/me', { token: await idp.token({ signWith: idp.strangerKey }) })).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('turns an unexpected repository failure into a generic 500, logging the cause', async () => {
    const t = await idp.token(); const org = await makeOrg(t);
    vi.spyOn(store, 'get').mockRejectedValue(new Error('connection to db-internal-7 lost'));
    const r = await call('GET', '/v1/org', { token: t, org });
    expect(r.status).toBe(500); expect(await r.text()).not.toContain('db-internal-7');
    expect(env.logs.join('')).toContain('db-internal-7');
  });

  it('a different identity cannot claim an existing email', async () => {
    const email = 'shared@camp.test';
    expect((await call('GET', '/v1/me', { token: await idp.token({ email }) })).status).toBe(200);
    expect((await call('GET', '/v1/me', { token: await idp.token({ email }) })).status).toBe(409);
  });
});
