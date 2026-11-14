import type { Household, HouseholdLinkInput, NewPersonInput, Person, PersonListQuery, PersonPatchInput, PersonSummary } from '@buxa/contracts';
import { can, isMinor, MAX_SEARCH_RESULTS, type Actor, type LocalDate } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { badRequest, conflict, notFound } from '../../http/errors';
import type { MembershipRecord } from '../../memberships/MembershipRepository';
import type { PersonHouseholdLink, PersonPatchRecord, PersonRecord } from '../../people/PeopleRepository';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toHouseholds, toPersonMembership, toSummary, onSiteByPerson } from '../shared/views';
import type { PeopleService, PeopleServiceDeps } from './PeopleService';
import { CAMPER_NEEDS_GUARDIAN, CHOOSE_ROLE, isGuardianRole, PICKUP_NEEDS_GUARDIAN, RELATIONSHIP_NEEDED } from './rules';

/** Blank text means "no value" for the optional contact fields and the preferred name. */
const blankToNull = (value: string | null): string | null => (value === null || value.trim() === '' ? null : value);

function toPatchRecord(patch: PersonPatchInput): PersonPatchRecord {
  const out: PersonPatchRecord = {};
  if (patch.givenName !== undefined) out.givenName = patch.givenName;
  if (patch.familyName !== undefined) out.familyName = patch.familyName;
  if (patch.preferredName !== undefined) out.preferredName = blankToNull(patch.preferredName);
  if (patch.dateOfBirth !== undefined) out.dateOfBirth = patch.dateOfBirth;
  if (patch.email !== undefined) out.email = blankToNull(patch.email);
  if (patch.phone !== undefined) out.phone = blankToNull(patch.phone);
  if (patch.roles !== undefined) out.roles = patch.roles;
  return out;
}

const requireRelationship = (relationship: string | undefined): string => {
  if (relationship === undefined || relationship.trim() === '') throw badRequest(RELATIONSHIP_NEEDED);
  return relationship;
};

/** Groups memberships by person. */
function byPerson(records: readonly MembershipRecord[]): Map<string, MembershipRecord[]> {
  const groups = new Map<string, MembershipRecord[]>();
  for (const record of records) groups.set(record.personId, [...(groups.get(record.personId) ?? []), record]);
  return groups;
}

export function createPeopleService(deps: PeopleServiceDeps): PeopleService {
  const { people, memberships, credentials, attendance, orgs, clock } = deps;

  const todayFor = async (orgId: string): Promise<LocalDate> => campToday(clock, await campZone(orgs, orgId));

  /** The full record as this actor may see it. Contact details are withheld from anyone without people:read_contact. */
  async function personView(actor: Actor, record: PersonRecord, today: LocalDate): Promise<Person> {
    const orgId = actor.orgId;
    const [ms, households, open, badge] = await Promise.all([
      memberships.forPerson(orgId, record.id),
      people.householdsOf(orgId, record.id),
      attendance.openFor(orgId, record.id),
      credentials.activeFor(orgId, record.id),
    ]);
    const seeContact = can(actor, 'people:read_contact');
    return {
      ...toSummary(record, ms, open !== null, today),
      dateOfBirth: seeContact ? record.dateOfBirth : null,
      email: seeContact ? record.email : null,
      phone: seeContact ? record.phone : null,
      isMinor: isMinor(record, today),
      memberships: ms.map(m => toPersonMembership(m, today)),
      households: await toHouseholds(people, orgId, households),
      hasActiveBadge: badge !== null,
    };
  }

  /** Whether the person is in some household that has a guardian other than themselves. */
  async function hasGuardianHousehold(orgId: string, personId: string): Promise<boolean> {
    const households = await people.householdsOf(orgId, personId);
    return households.some(h => h.members.some(m => m.personId !== personId && m.isGuardian));
  }

  /**
   * The household link for a new person, or undefined when they join none. A camper must join a household that already has a
   * guardian; a new household starts with none, so it can only take a non-camper. Checked before anything is written.
   */
  async function householdLinkFor(orgId: string, input: NewPersonInput): Promise<PersonHouseholdLink | undefined> {
    const camper = input.roles.includes('camper');
    const isGuardian = isGuardianRole(input.roles);
    if (input.householdId !== undefined) {
      const household = await people.getHousehold(orgId, input.householdId);
      if (!household) throw badRequest('That household does not exist.');
      if (camper && !household.members.some(m => m.isGuardian)) throw badRequest(CAMPER_NEEDS_GUARDIAN);
      return { householdId: input.householdId, relationship: requireRelationship(input.relationship), isGuardian, canPickup: false };
    }
    if (input.newHouseholdName !== undefined) {
      if (camper) throw badRequest(CAMPER_NEEDS_GUARDIAN);
      return { newHouseholdName: input.newHouseholdName, relationship: requireRelationship(input.relationship), isGuardian, canPickup: false };
    }
    if (camper) throw badRequest(CAMPER_NEEDS_GUARDIAN);
    return undefined;
  }

  return {
    async list(actor, query?: PersonListQuery): Promise<PersonSummary[]> {
      assertAllowed(actor, 'people:read');
      const orgId = actor.orgId;
      const term = query?.query?.trim() ?? '';
      const role = query?.role;
      const records = term === ''
        ? await people.list(orgId, { role, includeArchived: query?.includeArchived === true })
        : (await people.search(orgId, term, MAX_SEARCH_RESULTS)).filter(p => role === undefined || p.roles.includes(role));
      const [ms, onSite, today] = await Promise.all([
        memberships.forPeople(orgId, records.map(p => p.id)),
        onSiteByPerson(attendance, orgId),
        todayFor(orgId),
      ]);
      const groups = byPerson(ms);
      return records.map(p => toSummary(p, groups.get(p.id) ?? [], onSite.has(p.id), today));
    },

    async get(actor, id) {
      assertAllowed(actor, 'people:read');
      const record = await people.get(actor.orgId, id);
      if (!record) throw notFound('Person not found');
      return personView(actor, record, await todayFor(actor.orgId));
    },

    async create(actor, input) {
      assertAllowed(actor, 'people:create');
      const orgId = actor.orgId;
      if (input.roles.length === 0) throw badRequest(CHOOSE_ROLE);
      if (input.householdId !== undefined && input.newHouseholdName !== undefined) {
        throw badRequest('Choose an existing household or name a new one, not both.');
      }
      const link = await householdLinkFor(orgId, input);
      const record = await guard(() => people.create(actor, {
        givenName: input.givenName, familyName: input.familyName, preferredName: blankToNull(input.preferredName ?? null),
        dateOfBirth: input.dateOfBirth ?? null, email: blankToNull(input.email ?? null), phone: blankToNull(input.phone ?? null),
        roles: input.roles,
      }, link));
      return personView(actor, record, await todayFor(orgId));
    },

    async update(actor, id, patch) {
      assertAllowed(actor, 'people:update');
      const orgId = actor.orgId;
      if (patch.roles !== undefined && patch.roles.length === 0) throw badRequest(CHOOSE_ROLE);
      if (!(await people.get(orgId, id))) throw notFound('Person not found');
      if (patch.roles?.includes('camper') && !(await hasGuardianHousehold(orgId, id))) throw badRequest(CAMPER_NEEDS_GUARDIAN);
      const record = await guard(() => people.update(actor, id, toPatchRecord(patch)));
      return personView(actor, record, await todayFor(orgId));
    },

    async archive(actor, id) {
      assertAllowed(actor, 'people:delete');
      const orgId = actor.orgId;
      if (!(await people.get(orgId, id))) throw notFound('Person not found');
      if (await attendance.openFor(orgId, id)) throw conflict('Check them out before archiving.');
      // Archive first: if the badge revoke then fails, scans still refuse an archived person.
      const at = clock().toISOString();
      await guard(() => people.archive(actor, id, at));
      await guard(() => credentials.revoke(actor, id, at));
    },

    async createHousehold(actor, input) {
      assertAllowed(actor, 'people:create');
      const record = await guard(() => people.createHousehold(actor, input.name));
      return (await toHouseholds(people, actor.orgId, [record]))[0];
    },

    async linkToHousehold(actor, input: HouseholdLinkInput) {
      assertAllowed(actor, 'people:update');
      if (input.canPickup && !input.isGuardian) throw badRequest(PICKUP_NEEDS_GUARDIAN);
      const orgId = actor.orgId;
      if (!(await people.get(orgId, input.personId))) throw notFound('Person not found');
      const record = await guard(() => people.link(actor, {
        householdId: input.householdId, personId: input.personId, relationship: input.relationship,
        isGuardian: input.isGuardian, canPickup: input.canPickup,
      }));
      return (await toHouseholds(people, orgId, [record]))[0];
    },

    async unlinkFromHousehold(actor, householdId, personId) {
      assertAllowed(actor, 'people:update');
      const orgId = actor.orgId;
      const household = await people.getHousehold(orgId, householdId);
      if (!household) throw notFound('Household not found');
      const removed = household.members.find(m => m.personId === personId);
      if (removed?.isGuardian) {
        const others = household.members.filter(m => m.personId !== personId);
        const stillGuarded = others.some(m => m.isGuardian);
        if (!stillGuarded) {
          const companions = await people.getMany(orgId, others.map(m => m.personId));
          if (companions.some(p => p.roles.includes('camper'))) {
            throw conflict('A camper needs a parent or guardian in this household. Link another guardian first.');
          }
        }
      }
      const record = await guard(() => people.unlink(actor, householdId, personId));
      return (await toHouseholds(people, orgId, [record]))[0];
    },

    async getHousehold(actor, id) {
      assertAllowed(actor, 'people:read');
      const record = await people.getHousehold(actor.orgId, id);
      if (!record) throw notFound('Household not found');
      return (await toHouseholds(people, actor.orgId, [record]))[0];
    },

    async listHouseholds(actor) {
      assertAllowed(actor, 'people:read');
      return toHouseholds(people, actor.orgId, await people.listHouseholds(actor.orgId));
    },
  };
}
