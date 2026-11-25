import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { AccessStatus } from '@buxa/domain';

/** Expected outcomes are results, not exceptions, so a screen can render each one. Unexpected problems still throw. */
export type CheckInResult =
  /** `unassigned`: the camper had no active place in the session they were checked in to. The check-in still stands. */
  | { ok: true; entry: AttendanceEntry; overridden: boolean; unassigned: boolean }
  | { ok: false; reason: 'already_on_site'; since: string }
  | { ok: false; reason: 'not_valid'; status: Exclude<AccessStatus, 'valid'>; canOverride: boolean }
  | { ok: false; reason: 'override_needs_reason' }
  | { ok: false; reason: 'archived' };

export type CheckOutResult =
  | { ok: true; entry: AttendanceEntry; overridden: boolean }
  | { ok: false; reason: 'not_on_site' }
  | { ok: false; reason: 'pickup_required'; canOverride: boolean; guardians: PickupOption[] }
  | { ok: false; reason: 'pickup_not_authorised'; canOverride: boolean; guardians: PickupOption[] }
  | { ok: false; reason: 'override_needs_reason' };

/** Someone who may collect a child (a guardian with can_pickup in one of the child's households). */
export interface PickupOption {
  personId: string;
  name: string;
  relationship: string;
}

/**
 * `isMinor` is null when the actor may not see contact-level status (no people:read_contact, i.e. viewers). Pickup options are
 * only given when the child is known to be a minor, so they are empty for those viewers too.
 */
export interface OnSiteEntry {
  entry: AttendanceEntry;
  person: PersonSummary;
  isMinor: boolean | null;
  pickupOptions: PickupOption[];
}

/** The outcome of reading a code. `unknown` is the single neutral answer for unreadable, unknown and revoked codes alike. */
export type ScanResult = { kind: 'unknown' } | { kind: 'person'; person: PersonSummary };

/** The log filter's choices: the camp's sessions, its classes (a series, under its session) and its staff. */
export interface LogFilterChoices {
  sessions: { id: string; name: string }[];
  classes: { id: string; name: string; sessionId: string }[];
  staff: { id: string; name: string }[];
}
