import type { AttendanceEntry, AttendanceFilter, CheckInInput, CheckOutInput } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { AttendanceRepository } from '../../attendance/AttendanceRepository';
import type { ClassRepository } from '../../classes/ClassRepository';
import type { GroupRepository } from '../../groups/GroupRepository';
import type { TeacherScopeSource } from '../../classes/teacherScope';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

import type {
  CheckInResult,
  CheckOutResult,
  LogFilterChoices,
  OnSiteEntry,
  PickupOption,
} from '@buxa/shared/attendance/types';
import type { CheckInSessionOption } from '@buxa/shared/attendance/checkInSessions';
export type { CheckInResult, CheckInSessionOption, CheckOutResult, OnSiteEntry, PickupOption };

/**
 * Check-in and check-out, applying decideCheckIn and decideCheckOut from @buxa/domain. "Today" is the camp's local day
 * (orgs.timezone). Names are resolved for display; staff appear by name. Check-in needs attendance:record, an override also
 * attendance:override; reading needs attendance:read; the export needs attendance:export.
 */
export interface AttendanceService {
  /**
   * The sessions a check-in can name: those in progress today or starting today, in camp time. Needs attendance:record.
   * A camp with no such session has an empty list, and its check-ins stay camp-day visits.
   */
  checkInSessions(actor: Actor): Promise<CheckInSessionOption[]>;
  checkIn(actor: Actor, input: CheckInInput): Promise<CheckInResult>;
  checkOut(actor: Actor, input: CheckOutInput): Promise<CheckOutResult>;
  /** Everyone on site now, oldest arrival first. */
  onSite(actor: Actor): Promise<OnSiteEntry[]>;
  /** The log for camp-local days `from` to `to` inclusive, newest first. */
  log(actor: Actor, filter: AttendanceFilter): Promise<AttendanceEntry[]>;
  /** The choices the log's filter offers: sessions, classes (under their session) and staff. Needs attendance:read. */
  filterChoices(actor: Actor): Promise<LogFilterChoices>;
  /** One person's visits, newest first (for the person page). */
  history(actor: Actor, personId: string): Promise<AttendanceEntry[]>;
  /** CSV text for the same filter. Spreadsheet formulas in names or notes are neutralised. Needs attendance:export. */
  exportCsv(actor: Actor, filter: AttendanceFilter): Promise<string>;
}

export interface AttendanceServiceDeps {
  attendance: AttendanceRepository;
  /** Teachers see and record only their classes' campers; this supplies that scope (see classes/teacherScope.ts). */
  classes: AttendanceClassSource;
  /** Active assignments (who is placed in a group and room for a session). A check-in is flagged when the camper has none. */
  groups: Pick<GroupRepository, 'listAssignments'>;
  people: PeopleRepository;
  memberships: MembershipRepository;
  orgs: OrgRepository;
  clock: Clock;
}

/** The class storage check-in reads: the teacher scope and the camp's sessions. */
export type AttendanceClassSource = TeacherScopeSource & Pick<ClassRepository, 'listSessions'>;
