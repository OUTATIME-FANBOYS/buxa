import type { Pool } from 'pg';
import { PgAttendanceRepository } from './attendance/PgAttendanceRepository';
import { type AttendanceRepository } from './attendance/AttendanceRepository';
import type { ClassRepository } from './classes/ClassRepository';
import { PgClassRepository } from './classes/PgClassRepository';
import type { ImportRepository } from './classes/import/ImportRepository';
import { PgImportRepository } from './classes/import/PgImportRepository';
import { PgCredentialRepository } from './credentials/PgCredentialRepository';
import { type CredentialRepository } from './credentials/CredentialRepository';
import { PgMembershipRepository } from './memberships/PgMembershipRepository';
import { type MembershipRepository } from './memberships/MembershipRepository';
import { PgOrgRepository } from './orgs/PgOrgRepository';
import type { OrgRepository } from './orgs/OrgRepository';
import { PgPeopleRepository } from './people/PgPeopleRepository';
import { type PeopleRepository } from './people/PeopleRepository';
import { PgUserRepository } from './users/PgUserRepository';
import type { UserRepository } from './users/UserRepository';

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
}

export const createPgRepositories = (pool: Pool): Repositories => ({
  users: new PgUserRepository(pool),
  orgs: new PgOrgRepository(pool),
  people: new PgPeopleRepository(pool),
  memberships: new PgMembershipRepository(pool),
  credentials: new PgCredentialRepository(pool),
  attendance: new PgAttendanceRepository(pool),
  classes: new PgClassRepository(pool),
  imports: new PgImportRepository(pool),
});
