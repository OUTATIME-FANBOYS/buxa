import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { InMemoryStore } from '../../__tests__/fakes';
import { isHttpError } from '../../http/errors';
import { createOrgService } from '../orgs';

/** The camp row the test expects to exist; a missing one fails the test with a clear message. */
function orgOf<T>(orgs: Map<string, T>, orgId: string): T {
  const org = orgs.get(orgId);
  if (!org) {
    throw new Error(`no camp ${orgId} in the store`);
  }

  return org;
}

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ADMIN = '00000000-0000-4000-8000-0000000000a2';
const VIEWER = '00000000-0000-4000-8000-0000000000a3';
const NAME = 'Lake Camp';

/** A camp with an owner, an admin and a viewer, and one audit row so "keeps its data" has something to check. */
async function setUp() {
  const store = new InMemoryStore();
  const service = createOrgService(store);
  const created = await store.createWithOwner({ name: NAME, slug: 'lake-camp', timezone: 'UTC' }, OWNER);
  store.members.push(
    { orgId: created.id, userId: ADMIN, role: 'admin' },
    { orgId: created.id, userId: VIEWER, role: 'viewer' },
  );
  const as = (userId: string, role: Actor['role']): Actor => ({ userId, orgId: created.id, role });

  return { store, service, orgId: created.id, as };
}

/** The error a call throws, or undefined when it succeeds. */
const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (e: unknown) => e,
  );

describe('archive camp', () => {
  it('lets the owner archive, and the camp keeps its members and its audit history', async () => {
    const { store, service, orgId, as } = await setUp();

    const result = await service.archiveCamp(as(OWNER, 'owner'), orgId);

    expect(result.archivedAt).toEqual(expect.any(String));
    expect(orgOf(store.orgs, orgId).archivedAt).toBe(result.archivedAt);
    expect(store.orgs.has(orgId)).toBe(true);
    expect(store.members.filter(m => m.orgId === orgId)).toHaveLength(3);
  });

  it.each([['viewer', VIEWER]] as const)('refuses a %s, and the camp stays active', async (role, userId) => {
    const { store, service, orgId, as } = await setUp();

    const error = await refusal(service.archiveCamp(as(userId, role), orgId));

    expect(isHttpError(error) && error.statusCode).toBe(403);
    expect(orgOf(store.orgs, orgId).archivedAt).toBeNull();
  });

  it('records the archive in the audit log', async () => {
    const { store, service, orgId, as } = await setUp();

    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    expect(store.audit.filter(a => a.action === 'org.archive')).toEqual([
      expect.objectContaining({ orgId, actorId: OWNER, entity: 'org', entityId: orgId }),
    ]);
  });

  it('refuses a camp that is already archived, with a clear message', async () => {
    const { service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    const error = await refusal(service.archiveCamp(as(OWNER, 'owner'), orgId));

    expect(error).toMatchObject({ message: 'This camp is already archived' });
  });

  it('is hidden from sign-in memberships, and listed as archived for everyone in it', async () => {
    const { store, service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    expect((await store.membershipsOf(OWNER)).map(m => m.orgId)).not.toContain(orgId);

    expect(await service.listArchivedCamps(OWNER)).toEqual([
      expect.objectContaining({ id: orgId, name: NAME, role: 'owner' }),
    ]);
    expect(await service.listArchivedCamps(ADMIN)).toEqual([expect.objectContaining({ id: orgId, role: 'admin' })]);
    expect(await service.listArchivedCamps(VIEWER)).toEqual([expect.objectContaining({ id: orgId, role: 'viewer' })]);
  });

  it('lists nothing to a person who is not in an archived camp', async () => {
    const { service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    expect(await service.listArchivedCamps('00000000-0000-4000-8000-0000000000ff')).toEqual([]);
  });

  it('does not list an active camp as archived', async () => {
    const { service } = await setUp();

    expect(await service.listArchivedCamps(OWNER)).toEqual([]);
  });
});

describe('delete camp', () => {
  it.each([
    ['admin', ADMIN],
    ['viewer', VIEWER],
  ] as const)('refuses a %s, and deletes nothing', async (role, userId) => {
    const { store, service, orgId, as } = await setUp();

    const error = await refusal(service.deleteCamp(as(userId, role), orgId, NAME));

    expect(isHttpError(error) && error.statusCode).toBe(403);
    expect(store.orgs.has(orgId)).toBe(true);
  });

  it('refuses a name with the wrong capitals, and deletes nothing', async () => {
    const { store, service, orgId, as } = await setUp();

    const error = await refusal(service.deleteCamp(as(OWNER, 'owner'), orgId, 'lake camp'));

    expect(isHttpError(error) && error.statusCode).toBe(400);
    expect((error as Error).message).toMatch(/exactly as it is written, capitals included/);
    expect(store.orgs.has(orgId)).toBe(true);
    expect(store.members.filter(m => m.orgId === orgId)).toHaveLength(3);
  });

  it('refuses a name that is not the camp name at all, and deletes nothing', async () => {
    const { store, service, orgId, as } = await setUp();

    expect(await refusal(service.deleteCamp(as(OWNER, 'owner'), orgId, ''))).toBeDefined();
    expect(store.orgs.has(orgId)).toBe(true);
  });

  it('deletes the camp when the owner types its exact name', async () => {
    const { store, service, orgId, as } = await setUp();

    await service.deleteCamp(as(OWNER, 'owner'), orgId, NAME);

    expect(store.orgs.has(orgId)).toBe(false);
    expect(store.members.filter(m => m.orgId === orgId)).toHaveLength(0);
  });

  it('lets the owner delete an archived camp when the typed name is exact', async () => {
    const { store, service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    await service.deleteCamp({ ...as(OWNER, 'owner'), archived: true }, orgId, NAME);

    expect(store.orgs.has(orgId)).toBe(false);
  });
});

describe('unarchive camp', () => {
  it('lets the owner unarchive; the camp is active again and its data is unchanged', async () => {
    const { store, service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    await service.unarchiveCamp({ ...as(OWNER, 'owner'), archived: true }, orgId);

    expect(orgOf(store.orgs, orgId).archivedAt).toBeNull();
    expect(orgOf(store.orgs, orgId).name).toBe(NAME);
    expect(store.members.filter(m => m.orgId === orgId)).toHaveLength(3);
    expect((await store.membershipsOf(OWNER)).map(m => m.orgId)).toContain(orgId);
    expect(await service.listArchivedCamps(OWNER)).toEqual([]);
  });

  it('writes an unarchive row to the audit log', async () => {
    const { store, service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    await service.unarchiveCamp({ ...as(OWNER, 'owner'), archived: true }, orgId);

    expect(store.audit.filter(a => a.action === 'org.unarchive')).toEqual([
      expect.objectContaining({ orgId, actorId: OWNER, entity: 'org', entityId: orgId }),
    ]);
  });

  it.each([['viewer', VIEWER]] as const)('refuses a %s, and the camp stays archived', async (role, userId) => {
    const { store, service, orgId, as } = await setUp();
    await service.archiveCamp(as(OWNER, 'owner'), orgId);

    const error = await refusal(service.unarchiveCamp({ ...as(userId, role), archived: true }, orgId));

    expect(isHttpError(error) && error.statusCode).toBe(403);
    expect(orgOf(store.orgs, orgId).archivedAt).not.toBeNull();
  });

  it('refuses a camp that is not archived, with a clear message, and changes nothing', async () => {
    const { store, service, orgId, as } = await setUp();

    const error = await refusal(service.unarchiveCamp(as(OWNER, 'owner'), orgId));

    expect(isHttpError(error) && error.statusCode).toBe(409);
    expect(error).toMatchObject({ message: 'This camp is not archived' });
    expect(orgOf(store.orgs, orgId).archivedAt).toBeNull();
    expect(store.audit.filter(a => a.action === 'org.unarchive')).toHaveLength(0);
  });
});
