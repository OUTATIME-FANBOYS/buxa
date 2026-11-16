import type { Pool } from 'pg';
import { PgAttendanceRepository, type AttendanceRepository } from './attendance';
import type { ClassRepository } from './classes/ClassRepository';
import { PgClassRepository } from './classes/PgClassRepository';
import { PgCredentialRepository, type CredentialRepository } from './credentials';
import { PgMembershipRepository, type MembershipRepository } from './memberships';
import { PgOrgRepository } from './orgs/PgOrgRepository';
import type { OrgRepository } from './orgs/OrgRepository';
import { PgPeopleRepository, type PeopleRepository } from './people';
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
  /** Classes, sessions and enrolments (phase 2). The Postgres adapter in production; the in-memory one is for tests. */
  classes: ClassRepository;
}

export const createPgRepositories = (pool: Pool): Repositories => ({
  users: new PgUserRepository(pool),
  orgs: new PgOrgRepository(pool),
  people: new PgPeopleRepository(pool),
  memberships: new PgMembershipRepository(pool),
  credentials: new PgCredentialRepository(pool),
  attendance: new PgAttendanceRepository(pool),
  classes: new PgClassRepository(pool),
});
