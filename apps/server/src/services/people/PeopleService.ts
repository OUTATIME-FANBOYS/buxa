import type {
  Household,
  HouseholdLinkInput,
  NewHouseholdInput,
  NewPersonInput,
  Person,
  PersonListQuery,
  PersonPage,
  PersonPageQuery,
  PersonPatchInput,
  PersonHouseholdInput,
  PersonSummary,
} from '@buxa/contracts';
import type { Actor, CampRole } from '@buxa/domain';
import type { AttendanceRepository } from '../../attendance/AttendanceRepository';
import type { TeacherScopeSource } from '../../classes/teacherScope';
import type { CredentialRepository } from '../../credentials/CredentialRepository';
import type { MembershipRepository } from '../../memberships/MembershipRepository';
import type { OrgRepository } from '../../orgs/OrgRepository';
import type { PeopleRepository } from '../../people/PeopleRepository';
import type { Clock } from '../clock';

/**
 * People and households. Every method checks the actor's permission first (assertAllowed), applies the rules from @buxa/domain and
 * returns what that role may see: viewers receive names, roles and status only (date of birth, email, phone and isMinor come back null).
 * Expected failures are thrown as HttpError (400 invalid, 403 not allowed, 404 not found, 409 conflict) with a message safe to show.
 * Rules the implementation must enforce: a camper needs `householdId` of a household that has a guardian; roles are never empty;
 * the household link refuses `canPickup` without `isGuardian`.
 */
export interface PeopleService {
  /** Ordered list; with `query`, a name search capped at MAX_SEARCH_RESULTS. Needs people:read. */
  list(actor: Actor, query?: PersonListQuery): Promise<PersonSummary[]>;
  /**
   * One page of the people list, with the same visibility as `list`. The search and role apply before the count and the page, and
   * the total is the number of matches across all pages. Page size defaults to 25 and is capped at 100. Needs people:read.
   */
  listPage(actor: Actor, query?: PersonPageQuery): Promise<PersonPage>;
  /** Needs people:read. 404 if the id is not in this camp. Archived people still resolve by id. */
  get(actor: Actor, id: string): Promise<Person>;
  /** Needs people:create. */
  create(actor: Actor, input: NewPersonInput): Promise<Person>;
  /** Needs people:update. */
  update(actor: Actor, id: string, patch: PersonPatchInput): Promise<Person>;
  /** Needs people:delete. Archives; also revokes the active badge. Checked-in people cannot be archived (409). */
  archive(actor: Actor, id: string): Promise<void>;
  /** Owner only (data:erase). Deletes the person and their linked rows in one transaction. 404 for an unknown id, 403 for anyone but the owner. */
  erase(actor: Actor, id: string): Promise<void>;
  /** Needs people:create. */
  createHousehold(actor: Actor, input: NewHouseholdInput): Promise<Household>;
  /** Needs people:update. */
  linkToHousehold(actor: Actor, input: HouseholdLinkInput): Promise<Household>;
  /** Needs people:update. A camper's last guardian cannot be unlinked (409). */
  unlinkFromHousehold(actor: Actor, householdId: string, personId: string): Promise<Household>;
  /**
   * The household an edit sets for a person: join `householdId`, or create `newHouseholdName` (needs people:create as well), or,
   * with neither, leave the household they are in. Moves the person from their current household. `roles` are the roles the
   * person will hold after the edit (default: the roles they hold now), so a camper is checked against the new roles.
   * A camper needs a guardian in the household they join (400), and cannot be left without one (400 or 409).
   */
  setHousehold(actor: Actor, personId: string, input: PersonHouseholdInput, roles?: readonly CampRole[]): Promise<void>;
  /**
   * A person edit as one unit: the household change (when `household` is given) and the details. The household is changed first,
   * because a camper's guardian check reads the household. If the details then fail, the household is put back as it was, so a
   * refused edit changes nothing. A refusal from the household rule itself (400, 409) leaves both unchanged. Needs people:update.
   */
  updateWithHousehold(
    actor: Actor,
    id: string,
    patch: PersonPatchInput,
    household?: PersonHouseholdInput,
  ): Promise<Person>;
  /** Needs people:read. */
  getHousehold(actor: Actor, id: string): Promise<Household>;
  /** Every household in the camp, by name, with members. For a household picker. Needs people:read. */
  listHouseholds(actor: Actor): Promise<Household[]>;
}

export interface PeopleServiceDeps {
  people: PeopleRepository;
  memberships: MembershipRepository;
  credentials: CredentialRepository;
  attendance: AttendanceRepository;
  /** Teachers see only the campers of their classes (see classes/teacherScope.ts). */
  classes: TeacherScopeSource;
  orgs: OrgRepository;
  clock: Clock;
}
