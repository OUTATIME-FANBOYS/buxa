import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { loadHouseholdList, loadPeoplePage, loadPeoplePageOrForbidden, loadPersonMatches } from '../loadPersonPage';
import { HttpError } from '../../../http/errors';
import { settle } from '@buxa/domain';

const page = { people: [], total: 0, page: 1, pageSize: 25, pageCount: 1, from: 0, to: 0 };
const svc = vi.hoisted(() => ({
  people: {
    list: vi.fn(() => settle(() => ['people'])),
    listPage: vi.fn(() => settle(() => page)),
    listHouseholds: vi.fn(() => settle(() => ['houses'])),
  },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: svc }) }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;

describe('person page loaders', () => {
  beforeEach(() => vi.clearAllMocks());
  it('list the households a staff member can link into', async () => {
    expect(await loadHouseholdList(ACTOR)).toEqual(['houses']);
    expect(svc.people.listHouseholds).toHaveBeenCalledWith(ACTOR);
  });
  it('search people by name for linking', async () => {
    expect(await loadPersonMatches(ACTOR, 'Lee')).toEqual(['people']);
    expect(svc.people.list).toHaveBeenCalledWith(ACTOR, { query: 'Lee' });
  });
  it('loads one page with the search, role and page from the URL, leaving out empty values', async () => {
    await loadPeoplePage(ACTOR, { q: 'Lee', role: '', page: 2 });
    expect(svc.people.listPage).toHaveBeenCalledWith(ACTOR, { query: 'Lee', page: 2 });
    await loadPeoplePage(ACTOR, { q: '', role: '', page: 1 });
    expect(svc.people.listPage).toHaveBeenLastCalledWith(ACTOR, { page: 1 });
  });
  it('answers forbidden for a role that may not list people, and rethrows other failures', async () => {
    svc.people.listPage.mockResolvedValueOnce(page);
    expect(await loadPeoplePageOrForbidden(ACTOR, { q: '', role: '', page: 1 })).toEqual(page);
    svc.people.listPage.mockRejectedValueOnce(new HttpError(403, 'no'));
    expect(await loadPeoplePageOrForbidden(ACTOR, { q: '', role: '', page: 1 })).toBe('forbidden');
    svc.people.listPage.mockRejectedValueOnce(new Error('db down'));
    await expect(loadPeoplePageOrForbidden(ACTOR, { q: '', role: '', page: 1 })).rejects.toThrow('db down');
  });
});
