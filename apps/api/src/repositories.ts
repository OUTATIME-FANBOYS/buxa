import type { Pool } from 'pg';
import type { OrgRepository } from './orgs/OrgRepository';
import { PgOrgRepository } from './orgs/PgOrgRepository';
import type { UserRepository } from './users/UserRepository';
import { PgUserRepository } from './users/PgUserRepository';

/** Everything the routes read and write. Swap an implementation here to change where data lives. */
export interface Repositories { users: UserRepository; orgs: OrgRepository }

export const createPgRepositories = (pool: Pool): Repositories => ({ users: new PgUserRepository(pool), orgs: new PgOrgRepository(pool) });
