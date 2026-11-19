import type { Actor } from '@buxa/domain';

/** A seat hold as the app reads it. Times are ISO strings. A hold is active while `releasedAt` is null and `expiresAt` is in the future. */
export interface SeatHold {
  id: string;
  sessionId: string;
  householdId: string;
  createdAt: string;
  expiresAt: string;
  releasedAt: string | null;
  releaseReason: 'cancelled' | 'expired' | null;
}

export interface PlaceHoldRequest {
  sessionId: string;
  householdId: string;
  /** Set by the service (now plus the hold length). A repository test may pass another time. */
  expiresAt: Date;
}

/**
 * Storage for seat holds. Callers decide whether a hold may be taken (permissions in @buxa/domain); implementations take the seat
 * under the session lock, write the hold and its audit entry in one transaction. Every method is scoped to one camp.
 * Refusals are thrown as the errors in ../classes/errors.ts, and nothing is written for them.
 */
export interface SeatHoldRepository {
  /** Throws ClassNotFoundError, HouseholdNotFoundError, SessionFullError or HoldExistsError. Audits `hold.create`. */
  placeHold(actor: Actor, request: PlaceHoldRequest): Promise<SeatHold>;
  /** Throws HoldNotFoundError (also when already released). Audits `hold.release`, then promotes the waitlist into the freed place. */
  releaseHold(actor: Actor, holdId: string): Promise<SeatHold>;
  /** Releases every expired hold in one camp and promotes waitlists. Safe to run twice. Returns how many were released. */
  releaseExpiredHolds(orgId: string): Promise<number>;
}
