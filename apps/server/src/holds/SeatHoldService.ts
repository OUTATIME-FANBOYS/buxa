import { holdExpiresAt, type Actor } from '@buxa/domain';
import { assertAllowed } from '../auth/authorize';
import { attempt, type Outcome } from '../classes/outcome';
import type { SeatHold, SeatHoldRepository } from './SeatHoldRepository';

export interface PlaceHoldInput {
  /** The class (a row of `sessions`) to hold a place in. */
  classId: string;
  householdId: string;
}

/**
 * What the registration form and staff may ask of seat holds. Each method checks its permission first (a denial throws a 403)
 * and returns an Outcome for the expected cases.
 */
export interface SeatHoldService {
  placeHold(actor: Actor, input: PlaceHoldInput): Promise<Outcome<SeatHold>>;
  releaseHold(actor: Actor, holdId: string): Promise<Outcome<SeatHold>>;
  /**
   * The cleanup: releases the expired holds of one camp and promotes waitlists. It has no actor (it runs from a job), so it makes
   * no permission check. Safe to run twice. Expired holds stop counting on their own; this only tidies the table.
   */
  releaseExpiredHolds(userId: string, orgId: string): Promise<number>;
}

export interface SeatHoldServiceDeps {
  repo: SeatHoldRepository;
  /** The camp's IANA zone, used only to word refusals. */
  timezoneOf: (actor: Pick<Actor, 'userId' | 'orgId'>) => Promise<string>;
  now?: () => Date;
}

export function createSeatHoldService({
  repo,
  timezoneOf,
  now = () => new Date(),
}: SeatHoldServiceDeps): SeatHoldService {
  return {
    async placeHold(actor, input) {
      assertAllowed(actor, 'holds:manage');

      return attempt(
        () =>
          repo.placeHold(actor, {
            sessionId: input.classId,
            householdId: input.householdId,
            expiresAt: holdExpiresAt(now()),
          }),
        await timezoneOf(actor),
      );
    },

    async releaseHold(actor, holdId) {
      assertAllowed(actor, 'holds:manage');

      return attempt(() => repo.releaseHold(actor, holdId), await timezoneOf(actor));
    },

    releaseExpiredHolds(userId, orgId) {
      return repo.releaseExpiredHolds(userId, orgId);
    },
  };
}
