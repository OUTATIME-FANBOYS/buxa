import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { loadCampProfile, loadMembers } from '../loadCamp';
import { settle } from '@buxa/domain';

const svc = vi.hoisted(() => ({ orgs: { getCamp: vi.fn(() => settle(() => ({ name: 'Birchwood' }))), listMembers: vi.fn(() => settle(() => ({ members: [] }))) } }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: svc }) }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;

describe('camp loaders', () => {
  beforeEach(() => vi.clearAllMocks());
  it('read the camp record for the actor', async () => {
    expect(await loadCampProfile(ACTOR)).toEqual({ name: 'Birchwood' });
    expect(svc.orgs.getCamp).toHaveBeenCalledWith(ACTOR);
  });
  it('read the members of the camp', async () => {
    expect(await loadMembers(ACTOR)).toEqual({ members: [] });
    expect(svc.orgs.listMembers).toHaveBeenCalledWith(ACTOR);
  });
});
