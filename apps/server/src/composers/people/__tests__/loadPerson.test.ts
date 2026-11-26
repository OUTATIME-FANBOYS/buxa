import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { HttpError } from '../../../http/errors';
import { loadPerson } from '../loadPerson';

const h = vi.hoisted(() => ({ get: vi.fn(), requireSession: vi.fn() }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { people: { get: h.get } } }) }));
vi.mock('../../../session', () => ({ requireSession: h.requireSession }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;
const EMAIL = 'signed-in@example.org';

describe('loadPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireSession.mockResolvedValue({ user: { email: EMAIL } });
  });
  it('returns the person the service finds', async () => {
    h.get.mockResolvedValueOnce({ id: 'p-1', givenName: 'Ada' });
    expect(await loadPerson(ACTOR, 'p-1')).toEqual({ id: 'p-1', givenName: 'Ada' });
    // The signed-in email goes to the service, so a family's guardian sees the child's emergency contact.
    expect(h.get).toHaveBeenCalledWith(ACTOR, 'p-1', EMAIL);
  });
  it('returns null for a person who is not in this camp (404)', async () => {
    h.get.mockRejectedValueOnce(new HttpError(404, 'no such person'));
    expect(await loadPerson(ACTOR, 'p-9')).toBeNull();
  });
  it('rethrows any other failure', async () => {
    h.get.mockRejectedValueOnce(new HttpError(500, 'db down'));
    await expect(loadPerson(ACTOR, 'p-1')).rejects.toThrow('db down');
  });
});
