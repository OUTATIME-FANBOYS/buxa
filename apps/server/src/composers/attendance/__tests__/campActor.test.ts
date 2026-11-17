import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { campActor, campZone } from '../campActor';

const h = vi.hoisted(() => ({ findCampContext: vi.fn(), getCamp: vi.fn() }));
vi.mock('../../camp/campContext', () => ({ findCampContext: h.findCampContext }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { orgs: { getCamp: h.getCamp } } }) }));

const ACTOR = { userId: 'u-1', role: 'owner' } as unknown as Actor;

describe('attendance camp actor', () => {
  beforeEach(() => vi.clearAllMocks());
  it('is the actor of the camp the person is working in, or null without one', async () => {
    h.findCampContext.mockResolvedValueOnce({ actor: ACTOR });
    expect(await campActor()).toBe(ACTOR);
    h.findCampContext.mockResolvedValueOnce(null);
    expect(await campActor()).toBeNull();
  });
  it('reads the camp time zone through the orgs service', async () => {
    h.getCamp.mockResolvedValueOnce({ timezone: 'Europe/London' });
    expect(await campZone(ACTOR)).toBe('Europe/London');
    expect(h.getCamp).toHaveBeenCalledWith(ACTOR);
  });
});
