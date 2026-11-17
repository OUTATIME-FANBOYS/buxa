import type { AttendanceEntry, AttendanceFilter, CheckInInput, CheckOutInput } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { AttendanceRepository } from '../../attendance/AttendanceRepository';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

import type { CheckInResult, CheckOutResult, OnSiteEntry, PickupOption } from '@buxa/shared/attendance/types';
export type { CheckInResult, CheckOutResult, OnSiteEntry, PickupOption };

/**
 * Check-in and check-out, applying decideCheckIn and decideCheckOut from @buxa/domain. "Today" is the camp's local day
 * (orgs.timezone). Names are resolved for display; staff appear by name. Check-in needs attendance:record, an override also
 * attendance:override; reading needs attendance:read; the export needs attendance:export.
 */
export interface AttendanceService {
  checkIn(actor: Actor, input: CheckInInput): Promise<CheckInResult>;
  checkOut(actor: Actor, input: CheckOutInput): Promise<CheckOutResult>;
  /** Everyone on site now, oldest arrival first. */
  onSite(actor: Actor): Promise<OnSiteEntry[]>;
  /** The log for camp-local days `from` to `to` inclusive, newest first. */
  log(actor: Actor, filter: AttendanceFilter): Promise<AttendanceEntry[]>;
  /** One person's visits, newest first (for the person page). */
  history(actor: Actor, personId: string): Promise<AttendanceEntry[]>;
  /** CSV text for the same filter. Spreadsheet formulas in names or notes are neutralised. Needs attendance:export. */
  exportCsv(actor: Actor, filter: AttendanceFilter): Promise<string>;
}

export interface AttendanceServiceDeps {
  attendance: AttendanceRepository; people: PeopleRepository; memberships: MembershipRepository; orgs: OrgRepository; clock: Clock;
}
