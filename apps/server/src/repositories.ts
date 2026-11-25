import type { Pool } from 'pg';
import { PgAttendanceRepository } from './attendance/PgAttendanceRepository';
import { type AttendanceRepository } from './attendance/AttendanceRepository';
import type { CalendarRepository } from './calendar/CalendarService';
import { PgCalendarRepository } from './calendar/PgCalendarRepository';
import type { PublicSessionRepository } from './publicSessions/PublicSessionService';
import { PgPublicSessionRepository } from './publicSessions/PgPublicSessionRepository';
import type { ClassRepository } from './classes/ClassRepository';
import { PgClassRepository } from './classes/PgClassRepository';
import type { ImportRepository } from './classes/import/ImportRepository';
import type { GroupRepository } from './groups/GroupRepository';
import { PgGroupRepository } from './groups/PgGroupRepository';
import { PgImportRepository } from './classes/import/PgImportRepository';
import type { SeatHoldRepository } from './holds/SeatHoldRepository';
import { PgSeatHoldRepository } from './holds/PgSeatHoldRepository';
import { PgCredentialRepository, poolScope } from './credentials/PgCredentialRepository';
import { type CredentialRepository } from './credentials/CredentialRepository';
import { PgMembershipRepository } from './memberships/PgMembershipRepository';
import { type MembershipRepository } from './memberships/MembershipRepository';
import { PgOrgRepository } from './orgs/PgOrgRepository';
import type { OrgRepository } from './orgs/OrgRepository';
import { PgPeopleRepository } from './people/PgPeopleRepository';
import { type PeopleRepository } from './people/PeopleRepository';
import { PgRegistrationRepository } from './registration/PgRegistrationRepository';
import type { RegistrationRepository } from './registration/RegistrationRepository';
import { PgUserRepository } from './users/PgUserRepository';
import type { MemberInviteRepository } from './invites/MemberInviteRepository';
import { PgMemberInviteRepository } from './invites/PgMemberInviteRepository';
import type { UserRepository } from './users/UserRepository';
import type { GateRepository } from './gate/GateRepository';
import { PgGateRepository } from './gate/PgGateRepository';

/** Everything the services read and write. Swap an implementation here to change where data lives. */
export interface Repositories {
  users: UserRepository;
  orgs: OrgRepository;
  people: PeopleRepository;
  memberships: MembershipRepository;
  credentials: CredentialRepository;
  attendance: AttendanceRepository;
  /** Classes, sessions and enrolments. The Postgres adapter in production; the in-memory one is for tests. */
  classes: ClassRepository;
  /** The bulk import of classes' sessions. The Postgres adapter in production; the in-memory one is for tests. */
  imports: ImportRepository;
  /** Groups, rooms and assignments for a session (phase 4). The Postgres adapter in production; the in-memory one is for tests. */
  groups: GroupRepository;
  /** Registration forms and submissions. The Postgres adapter in production; the in-memory one is for tests. */
  registration: RegistrationRepository;
  /** Seat holds for registration. Postgres only: the seat rules live in the database (migration 0023). */
  seatHolds: SeatHoldRepository;
  /** The iCal feed token and the camp classes it reads. */
  calendar: CalendarRepository;
  /** The public session pages: read without sign-in. */
  publicSessions: PublicSessionRepository;
  /** Teacher invites: created, resent, listed, and accepted with the link. The Postgres adapter in production. */
  memberInvites: MemberInviteRepository;
  /** Check-in with a family's email: codes, device tokens and the camp's link. The Postgres adapter in production. */
  gate: GateRepository;
}

export const createPgRepositories = (pool: Pool): Repositories => ({
  users: new PgUserRepository(pool),
  orgs: new PgOrgRepository(pool),
  people: new PgPeopleRepository(pool),
  memberships: new PgMembershipRepository(pool),
  credentials: new PgCredentialRepository(poolScope(pool)),
  attendance: new PgAttendanceRepository(pool),
  classes: new PgClassRepository(pool),
  imports: new PgImportRepository(pool),
  groups: new PgGroupRepository(pool),
  registration: new PgRegistrationRepository(pool),
  seatHolds: new PgSeatHoldRepository(pool),
  calendar: new PgCalendarRepository(pool),
  publicSessions: new PgPublicSessionRepository(pool),
  memberInvites: new PgMemberInviteRepository(pool),
  gate: new PgGateRepository(pool),
});
