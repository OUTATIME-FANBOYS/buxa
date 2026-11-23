import { holdExpiresAt, type Actor } from '@buxa/domain';
import { assertAllowed } from '../auth/authorize';
import { attempt, type Outcome } from '../classes/outcome';
import type { CampActiveHold, ClassRepository } from '../classes/ClassRepository';
import type { ActiveHold, SeatHold, SeatHoldRepository } from './SeatHoldRepository';

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
  releaseExpiredHolds(userId: string | null, orgId: string): Promise<number>;
  /** The holds that hold a place in a class now. Needs holds:manage. */
  listActiveHolds(actor: Actor, sessionId: string): Promise<ActiveHold[]>;
  /**
   * Every hold in the camp that holds a place now, soonest expiry first, for the camp-wide holds screen. Read only. Needs
   * registration:read (the same people who can read registration).
   */
  listCampActiveHolds(actor: Actor): Promise<CampActiveHold[]>;
  /**
   * Moves the first waitlisted enrolments of a class into its free places (enrolment.promote, audited). Needs holds:manage. Returns
   * how many moved; 0 means no place was free.
   */
  promoteWaitlist(actor: Actor, sessionId: string): Promise<number>;
  /** The cleanup for every camp with expired holds, run by the scheduled job (apps/web/app/api/cron). Safe to run twice. */
  releaseExpiredHoldsEverywhere(): Promise<ExpiredHoldsSweep>;
}

/** What the all-camps cleanup did: how many camps it visited and how many holds it released. */
export interface ExpiredHoldsSweep {
  camps: number;
  released: number;
}

export interface SeatHoldServiceDeps {
  repo: SeatHoldRepository;
  /** The camp-wide read of live holds (one query, in the class repository). */
  classes: Pick<ClassRepository, 'listCampActiveHolds'>;
  /** The camp's IANA zone, used only to word refusals. */
  timezoneOf: (actor: Pick<Actor, 'userId' | 'orgId'>) => Promise<string>;
  now?: () => Date;
}

export function createSeatHoldService({
  repo,
  classes,
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

    async listActiveHolds(actor, sessionId) {
      assertAllowed(actor, 'holds:manage');

      return repo.listActiveHolds(actor.userId, actor.orgId, sessionId);
    },

    async listCampActiveHolds(actor) {
      assertAllowed(actor, 'registration:read');

      return classes.listCampActiveHolds(actor.userId, actor.orgId);
    },

    async promoteWaitlist(actor, sessionId) {
      assertAllowed(actor, 'holds:manage');

      return repo.promoteWaitlist(actor, sessionId);
    },

    async releaseExpiredHoldsEverywhere() {
      const camps = await repo.campsWithExpiredHolds();
      let released = 0;
      for (const camp of camps) {
        released += await repo.releaseExpiredHolds(camp.userId, camp.orgId);
      }

      return { camps: camps.length, released };
    },
  };
}
