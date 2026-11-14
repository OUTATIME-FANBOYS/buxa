import type { Actor } from '@buxa/domain';
import type { CheckInMethod } from '@buxa/contracts';

/** One visit. Instants are ISO strings. User ids are resolved to names by the service, not here. */
export interface CheckInRecord {
  id: string;
  personId: string;
  checkedInAt: string;
  checkedInBy: string | null;
  method: CheckInMethod;
  checkedOutAt: string | null;
  checkedOutBy: string | null;
  collectedByPersonId: string | null;
  overrideReason: string | null;
  note: string | null;
}

export interface NewCheckIn { personId: string; at: string; method: CheckInMethod; overrideReason: string | null; note: string | null }
export interface NewCheckOut { personId: string; at: string; collectedByPersonId: string | null; overrideReason: string | null; note: string | null }
/** `from` and `to` are instants (the service converts the camp's local days). `from` inclusive, `to` exclusive. */
export interface AttendanceQuery { from: string; to: string; personId?: string; onSiteOnly?: boolean }

export class AlreadyCheckedInError extends Error {
  readonly kind = 'already-checked-in';
  constructor() { super('Already checked in'); this.name = 'AlreadyCheckedInError'; }
}
export const isAlreadyCheckedIn = (e: unknown): e is AlreadyCheckedInError => e instanceof Error && (e as { kind?: unknown }).kind === 'already-checked-in';

export class NotOnSiteError extends Error {
  readonly kind = 'not-on-site';
  constructor() { super('Not on site'); this.name = 'NotOnSiteError'; }
}
export const isNotOnSite = (e: unknown): e is NotOnSiteError => e instanceof Error && (e as { kind?: unknown }).kind === 'not-on-site';

/** Most rows one query returns; a log longer than this is exported in date slices. */
export const MAX_LOG_ROWS = 5000;

export interface AttendanceRepository {
  /** The person's open visit, or null. */
  openFor(orgId: string, personId: string): Promise<CheckInRecord | null>;
  /** Everyone on site now, oldest arrival first. */
  onSite(orgId: string): Promise<CheckInRecord[]>;
  /** Audits `attendance.check_in`, and `attendance.override` as well when `overrideReason` is set. Throws AlreadyCheckedInError if a visit is open (the database refuses a second one even under a race), PersonNotFoundError. */
  checkIn(actor: Actor, input: NewCheckIn): Promise<CheckInRecord>;
  /** Closes the open visit. Audits `attendance.check_out` (and `attendance.override`). Throws NotOnSiteError. */
  checkOut(actor: Actor, input: NewCheckOut): Promise<CheckInRecord>;
  /** Newest first, at most MAX_LOG_ROWS. */
  log(orgId: string, query: AttendanceQuery): Promise<CheckInRecord[]>;
}
