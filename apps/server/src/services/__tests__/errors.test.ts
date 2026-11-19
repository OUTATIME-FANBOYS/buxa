import { describe, expect, it } from 'vitest';
import type { OrgRepository } from '../../orgs/OrgRepository';
import { OrgNotFoundError } from '../../orgs/OrgRepository';
import { createOrgService } from '../orgs';
import { isHttpError } from '../../http/errors';
import { translateRepositoryError } from '../shared/errors';

const pgError = (code: string) => Object.assign(new Error(`database said ${code} on users_pii`), { code });

describe('translateRepositoryError', () => {
  it.each(['23514', '22001', '22003', '22007', '22P02'])(
    'maps Postgres %s (a value the database refuses) to a 400 with a message that names no constraint',
    code => {
      const translated = translateRepositoryError(pgError(code));
      expect(isHttpError(translated)).toBe(true);
      expect(translated).toMatchObject({ statusCode: 400 });
      expect((translated as Error).message).not.toMatch(/users_pii|database|constraint/i);
    },
  );

  it('maps a missing camp to a 404', () => {
    expect(translateRepositoryError(new OrgNotFoundError())).toMatchObject({
      statusCode: 404,
      message: 'Camp not found',
    });
  });

  it('leaves other errors alone, so they still become a 500', () => {
    const unique = pgError('23505');
    expect(translateRepositoryError(unique)).toBe(unique);

    const plain = new Error('connection reset');
    expect(translateRepositoryError(plain)).toBe(plain);
  });
});

describe('the camp service', () => {
  const repo = (get: OrgRepository['get']): OrgRepository => ({
    createWithOwner: async () => {
      throw new Error('unused');
    },
    get,
    rename: async () => {
      throw new Error('unused');
    },
    listMembers: async () => [],
    archive: async () => {
      throw new Error('unused');
    },
    unarchive: async () => {
      throw new Error('unused');
    },
    deleteCamp: async () => {
      throw new Error('unused');
    },
    archivedCampsOf: async () => [],
  });
  const owner = {
    userId: '00000000-0000-4000-8000-000000000001',
    orgId: '00000000-0000-4000-8000-000000000002',
    role: 'owner' as const,
  };

  it('answers 404 for a camp the caller cannot see, instead of an unhandled error', async () => {
    const service = createOrgService(
      repo(async () => {
        throw new OrgNotFoundError();
      }),
    );
    const error: unknown = await service.getCamp(owner).catch((e: unknown) => e);
    expect(error).toMatchObject({ statusCode: 404, message: 'Camp not found' });
  });

  it('still returns a camp that exists', async () => {
    const org = {
      id: owner.orgId,
      name: 'Lake',
      slug: 'lake',
      createdAt: '2027-01-01T00:00:00.000Z',
      memberCount: 1,
      timezone: 'UTC',
      clockFormat: '24h' as const,
    };
    expect(await createOrgService(repo(async () => org)).getCamp(owner)).toEqual(org);
  });
});
