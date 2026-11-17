import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { HttpError } from '../../../http/errors';
import { loadHousehold } from '../loadHousehold';

const h = vi.hoisted(() => ({ getHousehold: vi.fn() }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: { people: { getHousehold: h.getHousehold } } }) }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;

describe('loadHousehold', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns the household the service finds', async () => {
    h.getHousehold.mockResolvedValueOnce({ id: 'h-1' });
    expect(await loadHousehold(ACTOR, 'h-1')).toEqual({ id: 'h-1' });
    expect(h.getHousehold).toHaveBeenCalledWith(ACTOR, 'h-1');
  });
  it('returns null when the household is not in this camp (404)', async () => {
    h.getHousehold.mockRejectedValueOnce(new HttpError(404, 'none'));
    expect(await loadHousehold(ACTOR, 'h-9')).toBeNull();
  });
  it('rethrows other failures', async () => {
    h.getHousehold.mockRejectedValueOnce(new HttpError(403, 'not yours'));
    await expect(loadHousehold(ACTOR, 'h-1')).rejects.toThrow('not yours');
  });
});
