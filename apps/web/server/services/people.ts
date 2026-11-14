import type { Household, HouseholdLinkInput, NewHouseholdInput, NewPersonInput, Person, PersonListQuery, PersonPatchInput, PersonSummary } from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { AttendanceRepository } from '../attendance/AttendanceRepository';
import type { CredentialRepository } from '../credentials/CredentialRepository';
import type { MembershipRepository } from '../memberships/MembershipRepository';
import type { OrgRepository } from '../orgs/OrgRepository';
import type { PeopleRepository } from '../people/PeopleRepository';
import { unimplemented } from '../unimplemented';
import type { Clock } from './clock';

/**
 * People and households. Every method checks the actor's permission first (assertAllowed), applies the rules from @buxa/domain and
 * returns what that role may see: viewers receive names, roles and status only (date of birth, email and phone come back null).
 * Expected failures are thrown as HttpError (400 invalid, 403 not allowed, 404 not found, 409 conflict) with a message safe to show.
 * Rules the implementation must enforce: a camper needs `householdId` of a household that has a guardian; roles are never empty;
 * the household link refuses `canPickup` without `isGuardian`.
 */
export interface PeopleService {
  /** Ordered list; with `query`, a name search capped at MAX_SEARCH_RESULTS. Needs people:read. */
  list(actor: Actor, query?: PersonListQuery): Promise<PersonSummary[]>;
  /** Needs people:read. 404 if the id is not in this camp. Archived people still resolve by id. */
  get(actor: Actor, id: string): Promise<Person>;
  /** Needs people:create. */
  create(actor: Actor, input: NewPersonInput): Promise<Person>;
  /** Needs people:update. */
  update(actor: Actor, id: string, patch: PersonPatchInput): Promise<Person>;
  /** Needs people:delete. Archives; also revokes the active badge. Checked-in people cannot be archived (409). */
  archive(actor: Actor, id: string): Promise<void>;
  /** Needs people:create. */
  createHousehold(actor: Actor, input: NewHouseholdInput): Promise<Household>;
  /** Needs people:update. */
  linkToHousehold(actor: Actor, input: HouseholdLinkInput): Promise<Household>;
  /** Needs people:update. A camper's last guardian cannot be unlinked (409). */
  unlinkFromHousehold(actor: Actor, householdId: string, personId: string): Promise<Household>;
  /** Needs people:read. */
  getHousehold(actor: Actor, id: string): Promise<Household>;
}

export interface PeopleServiceDeps {
  people: PeopleRepository; memberships: MembershipRepository; credentials: CredentialRepository; attendance: AttendanceRepository;
  orgs: OrgRepository; clock: Clock;
}

/** Replaced by the real implementation in chunk P2. */
export function createPeopleService(_deps: PeopleServiceDeps): PeopleService {
  return unimplemented('PeopleService');
}
