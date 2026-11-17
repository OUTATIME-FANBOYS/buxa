import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentActor } from '../camp';

const h = vi.hoisted(() => ({ requireSession: vi.fn(), getCurrentCamp: vi.fn(), toActor: vi.fn() }));
vi.mock('../../../session', () => ({ requireSession: h.requireSession, getCurrentCamp: h.getCurrentCamp, toActor: h.toActor }));

describe('currentActor', () => {
  beforeEach(() => vi.clearAllMocks());
  it('is null when the person has no camp selected', async () => {
    h.requireSession.mockResolvedValueOnce({ userId: 'u-1' });
    h.getCurrentCamp.mockResolvedValueOnce(null);
    expect(await currentActor()).toBeNull();
    expect(h.toActor).not.toHaveBeenCalled();
  });
  it('is the actor for the selected camp', async () => {
    const session = { userId: 'u-1' };
    const camp = { orgId: 'o-1' };
    h.requireSession.mockResolvedValueOnce(session);
    h.getCurrentCamp.mockResolvedValueOnce(camp);
    h.toActor.mockReturnValueOnce({ userId: 'u-1', orgId: 'o-1' });
    expect(await currentActor()).toEqual({ userId: 'u-1', orgId: 'o-1' });
    expect(h.toActor).toHaveBeenCalledWith(session, camp);
  });
});
