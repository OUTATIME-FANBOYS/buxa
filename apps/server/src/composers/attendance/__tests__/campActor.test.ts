import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { campActor, campClock, campZone } from '../campActor';

const h = vi.hoisted(() => ({ findCampContext: vi.fn(), getCamp: vi.fn(), requireSession: vi.fn() }));
vi.mock('../../../session', () => ({ requireSession: h.requireSession }));
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
  it("uses the signed-in person's clock first, then the camp's", async () => {
    h.getCamp.mockResolvedValue({ timezone: 'Europe/London', clockFormat: '24h' });
    h.requireSession.mockResolvedValueOnce({ user: { clockFormat: '12h' } });
    expect(await campClock(ACTOR)).toEqual({ timeZone: 'Europe/London', clockFormat: '12h' });
    h.requireSession.mockResolvedValueOnce({ user: { clockFormat: null } });
    expect(await campClock(ACTOR)).toEqual({ timeZone: 'Europe/London', clockFormat: '24h' });
  });
});
