import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { createSeatHoldService } from '../SeatHoldService';
import type { PlaceHoldRequest, SeatHold, SeatHoldRepository } from '../SeatHoldRepository';

const ORG = '22222222-2222-4222-8222-222222222222';
const as = (role: Actor['role']): Actor => ({ userId: '11111111-1111-4111-8111-111111111111', orgId: ORG, role });
const NOW = new Date('2027-07-05T09:00:00Z');

/** A repository that records what the service asked for and returns a fixed hold. */
function recordingRepo() {
  const placed: PlaceHoldRequest[] = [];
  const released: string[] = [];
  const hold: SeatHold = {
    id: 'hold-1',
    sessionId: 'class-1',
    householdId: 'house-1',
    createdAt: NOW.toISOString(),
    expiresAt: '2027-07-05T09:15:00.000Z',
    releasedAt: null,
    releaseReason: null,
  };
  const repo: SeatHoldRepository = {
    placeHold: (_actor, request) => {
      placed.push(request);

      return Promise.resolve(hold);
    },
    releaseHold: (_actor, holdId) => {
      released.push(holdId);

      return Promise.resolve({ ...hold, releasedAt: NOW.toISOString(), releaseReason: 'cancelled' });
    },
    releaseExpiredHolds: () => Promise.resolve(2),
    campsWithExpiredHolds: () => Promise.resolve([]),
    listActiveHolds: () => Promise.resolve([]),
    promoteWaitlist: () => Promise.resolve(0),
  };

  return { repo, placed, released };
}

const service = (repo: SeatHoldRepository) =>
  createSeatHoldService({
    repo,
    timezoneOf: () => Promise.resolve('Australia/Sydney'),
    holdMinutesOf: () => Promise.resolve(null),
    now: () => NOW,
  });

describe('seat hold service', () => {
  it('a staff member places a hold that expires 15 minutes after it is taken', async () => {
    const { repo, placed } = recordingRepo();
    const outcome = await service(repo).placeHold(as('staff'), { classId: 'class-1', householdId: 'house-1' });

    expect(outcome.ok).toBe(true);
    expect(placed).toEqual([
      { sessionId: 'class-1', householdId: 'house-1', expiresAt: new Date('2027-07-05T09:15:00Z') },
    ]);
  });

  it('a viewer cannot place or release a hold (403, nothing reaches the repository)', async () => {
    const { repo, placed, released } = recordingRepo();
    await expect(
      service(repo).placeHold(as('viewer'), { classId: 'class-1', householdId: 'house-1' }),
    ).rejects.toThrow();
    await expect(service(repo).releaseHold(as('viewer'), 'hold-1')).rejects.toThrow();
    expect(placed).toEqual([]);
    expect(released).toEqual([]);
  });

  it('an admin and an owner may release a hold', async () => {
    for (const role of ['admin', 'owner'] as const) {
      const { repo, released } = recordingRepo();
      const outcome = await service(repo).releaseHold(as(role), 'hold-1');
      expect(outcome.ok).toBe(true);
      expect(released).toEqual(['hold-1']);
    }
  });

  it('a hold placed after the camp changes its length uses the new length; a hold placed before keeps its own', async () => {
    const { repo, placed } = recordingRepo();
    let setting: number | null = null;
    const seats = createSeatHoldService({
      repo,
      timezoneOf: () => Promise.resolve('Australia/Sydney'),
      holdMinutesOf: () => Promise.resolve(setting),
      now: () => NOW,
    });

    await seats.placeHold(as('staff'), { classId: 'class-1', householdId: 'house-1' });
    setting = 45;
    await seats.placeHold(as('staff'), { classId: 'class-1', householdId: 'house-2' });
    setting = null;
    await seats.placeHold(as('staff'), { classId: 'class-1', householdId: 'house-3' });

    expect(placed.map(p => p.expiresAt.toISOString())).toEqual([
      '2027-07-05T09:15:00.000Z',
      '2027-07-05T09:45:00.000Z',
      '2027-07-05T09:15:00.000Z',
    ]);
  });

  it('the cleanup needs no actor and returns how many holds it released', async () => {
    const { repo } = recordingRepo();
    await expect(service(repo).releaseExpiredHolds('user-admin', ORG)).resolves.toBe(2);
  });
});
