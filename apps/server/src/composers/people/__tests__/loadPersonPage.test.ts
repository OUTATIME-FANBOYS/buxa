import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { loadHouseholdList, loadPeople, loadPeopleOrForbidden, loadPersonMatches } from '../loadPersonPage';
import { HttpError } from '../../../http/errors';
import { settle } from '@buxa/domain';

const svc = vi.hoisted(() => ({ people: { list: vi.fn(() => settle(() => ['people'])), listHouseholds: vi.fn(() => settle(() => ['houses'])) } }));
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
  it('list people with the search and role from the URL, leaving out empty values', async () => {
    await loadPeople(ACTOR, { q: 'Lee', role: '' });
    expect(svc.people.list).toHaveBeenCalledWith(ACTOR, { query: 'Lee' });
    await loadPeople(ACTOR, { q: '', role: '' });
    expect(svc.people.list).toHaveBeenLastCalledWith(ACTOR, {});
  });
  it('answers forbidden for a role that may not list people, and rethrows other failures', async () => {
    svc.people.list.mockResolvedValueOnce(['p']);
    expect(await loadPeopleOrForbidden(ACTOR, { q: '', role: '' })).toEqual(['p']);
    svc.people.list.mockRejectedValueOnce(new HttpError(403, 'no'));
    expect(await loadPeopleOrForbidden(ACTOR, { q: '', role: '' })).toBe('forbidden');
    svc.people.list.mockRejectedValueOnce(new Error('db down'));
    await expect(loadPeopleOrForbidden(ACTOR, { q: '', role: '' })).rejects.toThrow('db down');
  });
});
