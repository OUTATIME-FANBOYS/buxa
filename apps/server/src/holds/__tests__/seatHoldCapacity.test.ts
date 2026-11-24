import { describe, expect, it } from 'vitest';
import type { Actor } from '@buxa/domain';
import { holdExpiresAt, isHoldActive, seatFor, SEAT_HOLD_MINUTES } from '@buxa/domain';
import { SessionFullError } from '../../classes/errors';
import { createSeatHoldService } from '../SeatHoldService';
import type { PlaceHoldRequest, SeatHold, SeatHoldRepository } from '../SeatHoldRepository';

/*
 * Capacity in memory. The fake checks the seat and writes the hold with no await between the check and the write, which is what the
 * session lock gives the Postgres adapter. Concurrent calls therefore see each other's holds, and the rule is the domain's own.
 */

const ORG = '22222222-2222-4222-8222-222222222222';
const actor: Actor = { userId: '11111111-1111-4111-8111-111111111111', orgId: ORG, role: 'staff' };
const START = new Date('2027-07-05T09:00:00Z');

/** A seat hold repository that keeps holds in an array. `clock.now` is the time the holds are judged at. */
function memoryHolds(capacity: number, clock: { now: Date }) {
  const holds: SeatHold[] = [];
  const repo: Pick<SeatHoldRepository, 'placeHold'> = {
    placeHold: async (_actor: Actor, request: PlaceHoldRequest) => {
      await Promise.resolve();
      const taken = holds.filter(
        h =>
          h.sessionId === request.sessionId &&
          isHoldActive(
            { releasedAt: h.releasedAt === null ? null : new Date(h.releasedAt), expiresAt: new Date(h.expiresAt) },
            clock.now,
          ),
      ).length;
      if (seatFor(capacity, taken).kind === 'full') {
        throw new SessionFullError({ kind: 'refuse', reason: 'session_full', capacity });
      }
      const hold: SeatHold = {
        id: `hold-${holds.length + 1}`,
        sessionId: request.sessionId,
        householdId: request.householdId,
        personId: request.personId,
        createdAt: clock.now.toISOString(),
        expiresAt: request.expiresAt.toISOString(),
        releasedAt: null,
        releaseReason: null,
      };
      holds.push(hold);

      return hold;
    },
  };

  return { repo, holds };
}

/** The seat hold service over the in-memory repository. Only placeHold is reached here, so the other methods are stubs. */
function service(repo: Pick<SeatHoldRepository, 'placeHold'>, clock: { now: Date }) {
  return createSeatHoldService({
    classes: { listCampActiveHolds: () => Promise.resolve([]) },
    repo: {
      ...repo,
      releaseHold: () => Promise.reject(new Error('not used in this test')),
      releaseExpiredHolds: () => Promise.resolve(0),
      campsWithExpiredHolds: () => Promise.resolve([]),
      listActiveHolds: () => Promise.resolve([]),
      promoteWaitlist: () => Promise.resolve(0),
    },
    timezoneOf: () => Promise.resolve('Australia/Sydney'),
    holdMinutesOf: () => Promise.resolve(null),
    now: () => clock.now,
  });
}

describe('seat holds in memory: capacity', () => {
  it('ten concurrent holds on a 3-place class take exactly 3 places; the rest are refused as full', async () => {
    const clock = { now: START };
    const { repo, holds } = memoryHolds(3, clock);
    const seats = service(repo, clock);

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        seats.placeHold(actor, { classId: 'class-1', householdId: `house-${i}`, personId: `house-${i}` }),
      ),
    );

    expect(outcomes.filter(o => o.ok)).toHaveLength(3);
    const refused = outcomes.filter(o => !o.ok);
    expect(refused).toHaveLength(7);
    expect(refused.every(o => !o.ok && o.failure.reason === 'session_full')).toBe(true);
    expect(holds).toHaveLength(3);
  });

  it('a hold lasts SEAT_HOLD_MINUTES and then frees its place', async () => {
    const clock = { now: START };
    const { repo } = memoryHolds(1, clock);
    const seats = service(repo, clock);

    expect(
      await seats.placeHold(actor, { classId: 'class-1', householdId: 'house-a', personId: 'house-a' }),
    ).toMatchObject({ ok: true });
    expect(
      await seats.placeHold(actor, { classId: 'class-1', householdId: 'house-b', personId: 'house-b' }),
    ).toMatchObject({
      ok: false,
      failure: { reason: 'session_full' },
    });

    clock.now = new Date(START.getTime() + SEAT_HOLD_MINUTES * 60_000 - 1);
    expect(
      await seats.placeHold(actor, { classId: 'class-1', householdId: 'house-b', personId: 'house-b' }),
    ).toMatchObject({ ok: false });

    clock.now = holdExpiresAt(START);
    expect(
      await seats.placeHold(actor, { classId: 'class-1', householdId: 'house-b', personId: 'house-b' }),
    ).toMatchObject({ ok: true });
  });
});
