import type { Actor } from '@buxa/domain';

/** A seat hold as the app reads it. Times are ISO strings. A hold is active while `releasedAt` is null and `expiresAt` is in the future. */
export interface SeatHold {
  id: string;
  sessionId: string;
  householdId: string;
  /** The child the place is held for. Null only on a hold released before holds were per child (migration 0055). */
  personId: string | null;
  createdAt: string;
  expiresAt: string;
  releasedAt: string | null;
  /** `completed` is set when a registration is confirmed and its enrolment is created (migration 0043). */
  releaseReason: 'cancelled' | 'expired' | 'completed' | null;
}

export interface PlaceHoldRequest {
  sessionId: string;
  householdId: string;
  /** The child (a member of the household) the place is held for. Two children of one household each hold their own place. */
  personId: string;
  /** Set by the service (now plus the hold length). A repository test may pass another time. */
  expiresAt: Date;
}

/** A hold that holds a place right now, with the household's name for the class page. */
export interface ActiveHold {
  id: string;
  householdId: string;
  householdName: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Storage for seat holds. Callers decide whether a hold may be taken (permissions in @buxa/domain); implementations take the seat
 * under the session lock, write the hold and its audit entry in one transaction. Every method is scoped to one camp.
 * Refusals are thrown as the errors in ../classes/errors.ts, and nothing is written for them.
 */
export interface SeatHoldRepository {
  /** Throws ClassNotFoundError, HouseholdNotFoundError, CamperNotFoundError (the child is not in the household), SessionFullError or HoldExistsError. Audits `hold.create`. */
  placeHold(actor: Actor, request: PlaceHoldRequest): Promise<SeatHold>;
  /** Throws HoldNotFoundError (also when already released). Audits `hold.release`, then promotes the waitlist into the freed place. */
  releaseHold(actor: Actor, holdId: string): Promise<SeatHold>;
  /** Releases every expired hold in one camp and promotes waitlists. Safe to run twice. Returns how many were released. */
  releaseExpiredHolds(userId: string | null, orgId: string): Promise<number>;
  /** The camps that have expired holds not yet released, each with a member to run the cleanup as (migration 0043). */
  campsWithExpiredHolds(): Promise<{ orgId: string; userId: string }[]>;
  /** The holds that hold a place in a class right now (unreleased and not yet expired), oldest first. Throws ClassNotFoundError. */
  listActiveHolds(userId: string, orgId: string, sessionId: string): Promise<ActiveHold[]>;
  /**
   * Moves the first waitlisted enrolments into the places that are free (the existing enrolment.promote path). Audits each promotion.
   * Returns how many moved. Throws ClassNotFoundError.
   */
  promoteWaitlist(actor: Actor, sessionId: string): Promise<number>;
}
