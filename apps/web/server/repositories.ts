import type { Pool } from 'pg';
import type { AttendanceRepository } from './attendance/AttendanceRepository';
import type { CredentialRepository } from './credentials/CredentialRepository';
import type { MembershipRepository } from './memberships/MembershipRepository';
import type { OrgRepository } from './orgs/OrgRepository';
import { PgOrgRepository } from './orgs/PgOrgRepository';
import type { PeopleRepository } from './people/PeopleRepository';
import { unimplemented } from './unimplemented';
import type { UserRepository } from './users/UserRepository';
import { PgUserRepository } from './users/PgUserRepository';

/** Everything the services read and write. Swap an implementation here to change where data lives. */
export interface Repositories {
  users: UserRepository;
  orgs: OrgRepository;
  people: PeopleRepository;
  memberships: MembershipRepository;
  credentials: CredentialRepository;
  attendance: AttendanceRepository;
}

export const createPgRepositories = (pool: Pool): Repositories => ({
  users: new PgUserRepository(pool),
  orgs: new PgOrgRepository(pool),
  // Replaced by the Postgres adapters in chunk P1.
  people: unimplemented('PeopleRepository'),
  memberships: unimplemented('MembershipRepository'),
  credentials: unimplemented('CredentialRepository'),
  attendance: unimplemented('AttendanceRepository'),
});
