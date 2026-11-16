import type { AccessStatus } from './membership';

/** Why a check-in was refused, or how it was allowed. A tagged union so callers must handle every case. */
export type CheckInDecision =
  | { kind: 'allow' }
  | { kind: 'allow_override'; reason: string }
  | { kind: 'refuse'; reason: 'already_on_site'; since: string }
  | { kind: 'refuse'; reason: 'not_valid'; status: Exclude<AccessStatus, 'valid'>; canOverride: boolean }
  | { kind: 'refuse'; reason: 'override_needs_reason' };

export interface CheckInFacts {
  status: AccessStatus;
  /** When the person checked in, if they are on site now. */
  onSiteSince: string | null;
  /** Does the actor hold `attendance:override`? */
  canOverride: boolean;
  /** Present when the actor is asking to override. `undefined` means they are not. */
  overrideReason?: string;
}

/** The check-in rule (spec rule 2). Pure: the service gathers the facts and acts on the answer. */
export function decideCheckIn(f: CheckInFacts): CheckInDecision {
  if (f.onSiteSince !== null) return { kind: 'refuse', reason: 'already_on_site', since: f.onSiteSince };
  if (f.status === 'valid') return { kind: 'allow' };
  if (f.overrideReason === undefined) return { kind: 'refuse', reason: 'not_valid', status: f.status, canOverride: f.canOverride };
  if (!f.canOverride) return { kind: 'refuse', reason: 'not_valid', status: f.status, canOverride: false };
  const reason = f.overrideReason.trim();
  return reason === '' ? { kind: 'refuse', reason: 'override_needs_reason' } : { kind: 'allow_override', reason };
}

export type CheckOutDecision =
  | { kind: 'allow' }
  | { kind: 'allow_override'; reason: string }
  | { kind: 'refuse'; reason: 'not_on_site' }
  | { kind: 'refuse'; reason: 'pickup_required'; canOverride: boolean }
  | { kind: 'refuse'; reason: 'pickup_not_authorised'; canOverride: boolean }
  | { kind: 'refuse'; reason: 'override_needs_reason' };

export interface CheckOutFacts {
  onSite: boolean;
  isMinor: boolean;
  /** Who is collecting. `null` when nobody was chosen. `canPickup` is true only for a guardian of this child with can_pickup. */
  collectedBy: { personId: string; canPickup: boolean } | null;
  canOverride: boolean;
  overrideReason?: string;
}

/** The check-out rule (spec rule 3): a child leaves only with an authorised guardian, unless an admin overrides with a reason. */
export function decideCheckOut(f: CheckOutFacts): CheckOutDecision {
  if (!f.onSite) return { kind: 'refuse', reason: 'not_on_site' };
  if (!f.isMinor) return { kind: 'allow' };
  if (f.collectedBy?.canPickup) return { kind: 'allow' };
  if (f.overrideReason !== undefined && f.canOverride) {
    const reason = f.overrideReason.trim();
    return reason === '' ? { kind: 'refuse', reason: 'override_needs_reason' } : { kind: 'allow_override', reason };
  }
  return f.collectedBy === null
    ? { kind: 'refuse', reason: 'pickup_required', canOverride: f.canOverride }
    : { kind: 'refuse', reason: 'pickup_not_authorised', canOverride: f.canOverride };
}
