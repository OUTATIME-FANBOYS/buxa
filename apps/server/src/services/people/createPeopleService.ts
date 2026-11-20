import type {
  HouseholdLinkInput,
  NewPersonInput,
  Person,
  PersonListQuery,
  PersonPatchInput,
  PersonSummary,
} from '@buxa/contracts';
import { can, isMinor, MAX_SEARCH_RESULTS, type Actor, type LocalDate } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { assignedTo, teacherScopeOf } from '../../classes/teacherScope';
import { badRequest, conflict, notFound } from '../../http/errors';
import type { MembershipRecord } from '../../memberships/MembershipRepository';
import type { PersonHouseholdLink, PersonPatchRecord, PersonRecord } from '../../people/PeopleRepository';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toHouseholds, toPersonMembership, toSummary, onSiteByPerson } from '../shared/views';
import type { PeopleService, PeopleServiceDeps } from './PeopleService';
import {
  CAMPER_NEEDS_GUARDIAN,
  CHOOSE_ROLE,
  isGuardianRole,
  PICKUP_NEEDS_GUARDIAN,
  RELATIONSHIP_NEEDED,
} from './rules';

/** Blank text means "no value" for the optional contact fields and the preferred name. */
const blankToNull = (value: string | null): string | null => (value === null || value.trim() === '' ? null : value);

function toPatchRecord(patch: PersonPatchInput): PersonPatchRecord {
  const out: PersonPatchRecord = {};
  if (patch.givenName !== undefined) {
    out.givenName = patch.givenName;
  }
  if (patch.familyName !== undefined) {
    out.familyName = patch.familyName;
  }
  if (patch.preferredName !== undefined) {
    out.preferredName = blankToNull(patch.preferredName);
  }
  if (patch.dateOfBirth !== undefined) {
    out.dateOfBirth = patch.dateOfBirth;
  }
  if (patch.email !== undefined) {
    out.email = blankToNull(patch.email);
  }
  if (patch.phone !== undefined) {
    out.phone = blankToNull(patch.phone);
  }
  if (patch.roles !== undefined) {
    out.roles = patch.roles;
  }

  return out;
}

const requireRelationship = (relationship: string | undefined): string => {
  if (relationship === undefined || relationship.trim() === '') {
    throw badRequest(RELATIONSHIP_NEEDED);
  }

  return relationship;
};

/**
 * Whether the actor sees custody information: memberships, guardian and pick-up flags, badge status. Staff and above only, the
 * same line as people:read_contact. Viewers get names and roles.
 */
const seesCustody = (actor: Actor): boolean => can(actor, 'people:read_contact');

/** Groups memberships by person. */
function byPerson(records: readonly MembershipRecord[]): Map<string, MembershipRecord[]> {
  const groups = new Map<string, MembershipRecord[]>();
  for (const record of records) {
    groups.set(record.personId, [...(groups.get(record.personId) ?? []), record]);
  }

  return groups;
}

export function createPeopleService(deps: PeopleServiceDeps): PeopleService {
  const { people, memberships, credentials, attendance, classes, orgs, clock } = deps;

  const todayFor = async (actor: Pick<Actor, 'userId' | 'orgId'>): Promise<LocalDate> =>
    campToday(clock, await campZone(orgs, actor));

  /**
   * The full record as this actor may see it. Contact details and the minor flag are withheld from anyone without people:read_contact.
   * Memberships, pick-up flags and badge status are withheld from the same roles (see seesCustody).
   */
  async function personView(actor: Actor, record: PersonRecord, today: LocalDate): Promise<Person> {
    const orgId = actor.orgId;
    const [ms, households, open, badge] = await Promise.all([
      memberships.forPerson(actor.userId, orgId, record.id),
      people.householdsOf(actor.userId, orgId, record.id),
      attendance.openFor(actor.userId, orgId, record.id),
      credentials.activeFor(actor.userId, orgId, record.id),
    ]);
    const seeContact = can(actor, 'people:read_contact');
    const custody = seesCustody(actor);

    return {
      ...toSummary(record, ms, open !== null, today, custody),
      dateOfBirth: seeContact ? record.dateOfBirth : null,
      email: seeContact ? record.email : null,
      phone: seeContact ? record.phone : null,
      isMinor: seeContact ? isMinor(record, today) : null,
      memberships: custody ? ms.map(m => toPersonMembership(m, today)) : null,
      // A teacher sees no households: their members are guardians and other families, by name.
      households: actor.role === 'teacher' ? [] : await toHouseholds(people, actor, households, custody),
      hasActiveBadge: custody ? badge !== null : null,
    };
  }

  /** Whether the person is in some household that has a guardian other than themselves. */
  async function hasGuardianHousehold(actor: Pick<Actor, 'userId' | 'orgId'>, personId: string): Promise<boolean> {
    const households = await people.householdsOf(actor.userId, actor.orgId, personId);

    return households.some(h => h.members.some(m => m.personId !== personId && m.isGuardian));
  }

  /**
   * The household link for a new person, or undefined when they join none. A camper must join a household that already has a
   * guardian; a new household starts with none, so it can only take a non-camper. Checked before anything is written.
   */
  async function householdLinkFor(
    actor: Pick<Actor, 'userId' | 'orgId'>,
    input: NewPersonInput,
  ): Promise<PersonHouseholdLink | undefined> {
    const camper = input.roles.includes('camper');
    const isGuardian = isGuardianRole(input.roles);
    if (input.householdId !== undefined) {
      const household = await people.getHousehold(actor.userId, actor.orgId, input.householdId);
      if (!household) {
        throw badRequest('That household does not exist.');
      }
      if (camper && !household.members.some(m => m.isGuardian)) {
        throw badRequest(CAMPER_NEEDS_GUARDIAN);
      }

      return {
        householdId: input.householdId,
        relationship: requireRelationship(input.relationship),
        isGuardian,
        canPickup: false,
      };
    }
    if (input.newHouseholdName !== undefined) {
      if (camper) {
        throw badRequest(CAMPER_NEEDS_GUARDIAN);
      }

      return {
        newHouseholdName: input.newHouseholdName,
        relationship: requireRelationship(input.relationship),
        isGuardian,
        canPickup: false,
      };
    }
    if (camper) {
      throw badRequest(CAMPER_NEEDS_GUARDIAN);
    }

    return undefined;
  }

  return {
    async list(actor, query?: PersonListQuery): Promise<PersonSummary[]> {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'people:read', { assignedToClass: scope === null ? undefined : true });
      const orgId = actor.orgId;
      const term = query?.query?.trim() ?? '';
      const role = query?.role;
      const found =
        term === ''
          ? await people.list(actor.userId, orgId, { role, includeArchived: query?.includeArchived === true })
          : (await people.search(actor.userId, orgId, term, MAX_SEARCH_RESULTS)).filter(
              p => role === undefined || p.roles.includes(role),
            );
      const records = scope === null ? found : found.filter(p => scope.camperIds.has(p.id));
      const [ms, onSite, today] = await Promise.all([
        memberships.forPeople(
          actor.userId,
          orgId,
          records.map(p => p.id),
        ),
        onSiteByPerson(attendance, actor),
        todayFor(actor),
      ]);
      const groups = byPerson(ms);
      const custody = seesCustody(actor);

      return records.map(p => toSummary(p, groups.get(p.id) ?? [], onSite.has(p.id), today, custody));
    },

    async get(actor, id) {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'people:read', { assignedToClass: assignedTo(scope, id) });
      const record = await people.get(actor.userId, actor.orgId, id);
      if (!record) {
        throw notFound('Person not found');
      }

      return personView(actor, record, await todayFor(actor));
    },

    async create(actor, input) {
      assertAllowed(actor, 'people:create');
      if (input.roles.length === 0) {
        throw badRequest(CHOOSE_ROLE);
      }
      if (input.householdId !== undefined && input.newHouseholdName !== undefined) {
        throw badRequest('Choose an existing household or name a new one, not both.');
      }
      const link = await householdLinkFor(actor, input);
      const record = await guard(() =>
        people.create(
          actor,
          {
            givenName: input.givenName,
            familyName: input.familyName,
            preferredName: blankToNull(input.preferredName ?? null),
            dateOfBirth: input.dateOfBirth ?? null,
            email: blankToNull(input.email ?? null),
            phone: blankToNull(input.phone ?? null),
            roles: input.roles,
          },
          link,
        ),
      );

      return personView(actor, record, await todayFor(actor));
    },

    async update(actor, id, patch) {
      assertAllowed(actor, 'people:update');
      const orgId = actor.orgId;
      if (patch.roles !== undefined && patch.roles.length === 0) {
        throw badRequest(CHOOSE_ROLE);
      }
      if (!(await people.get(actor.userId, orgId, id))) {
        throw notFound('Person not found');
      }
      if (patch.roles?.includes('camper') && !(await hasGuardianHousehold(actor, id))) {
        throw badRequest(CAMPER_NEEDS_GUARDIAN);
      }
      const record = await guard(() => people.update(actor, id, toPatchRecord(patch)));

      return personView(actor, record, await todayFor(actor));
    },

    async archive(actor, id) {
      assertAllowed(actor, 'people:delete');
      const orgId = actor.orgId;
      if (!(await people.get(actor.userId, orgId, id))) {
        throw notFound('Person not found');
      }
      if (await attendance.openFor(actor.userId, orgId, id)) {
        throw conflict('Check them out before archiving.');
      }
      // Archive first: if the badge revoke then fails, scans still refuse an archived person.
      const at = clock().toISOString();
      await guard(() => people.archive(actor, id, at));
      await guard(() => credentials.revoke(actor, id, at));
    },

    async createHousehold(actor, input) {
      assertAllowed(actor, 'people:create');
      const record = await guard(() => people.createHousehold(actor, input.name));

      return (await toHouseholds(people, actor, [record], seesCustody(actor)))[0];
    },

    async linkToHousehold(actor, input: HouseholdLinkInput) {
      assertAllowed(actor, 'people:update');
      if (input.canPickup && !input.isGuardian) {
        throw badRequest(PICKUP_NEEDS_GUARDIAN);
      }
      const orgId = actor.orgId;
      if (!(await people.get(actor.userId, orgId, input.personId))) {
        throw notFound('Person not found');
      }
      // Authorising pickup is its own permission. It is needed whenever the flag is set, or cleared from a person who has it.
      const household = await people.getHousehold(actor.userId, actor.orgId, input.householdId);
      const hadPickup = household?.members.find(m => m.personId === input.personId)?.canPickup ?? false;
      if (input.canPickup || hadPickup) {
        assertAllowed(actor, 'people:authorise_pickup');
      }
      const record = await guard(() =>
        people.link(actor, {
          householdId: input.householdId,
          personId: input.personId,
          relationship: input.relationship,
          isGuardian: input.isGuardian,
          canPickup: input.canPickup,
        }),
      );

      return (await toHouseholds(people, actor, [record], seesCustody(actor)))[0];
    },

    async unlinkFromHousehold(actor, householdId, personId) {
      assertAllowed(actor, 'people:update');
      const orgId = actor.orgId;
      const household = await people.getHousehold(actor.userId, orgId, householdId);
      if (!household) {
        throw notFound('Household not found');
      }
      const removed = household.members.find(m => m.personId === personId);
      if (removed?.isGuardian) {
        const others = household.members.filter(m => m.personId !== personId);
        const stillGuarded = others.some(m => m.isGuardian);
        if (!stillGuarded) {
          const companions = await people.getMany(
            actor.userId,
            orgId,
            others.map(m => m.personId),
          );
          if (companions.some(p => p.roles.includes('camper'))) {
            throw conflict('A camper needs a parent or guardian in this household. Link another guardian first.');
          }
        }
      }
      const record = await guard(() => people.unlink(actor, householdId, personId));

      return (await toHouseholds(people, actor, [record], seesCustody(actor)))[0];
    },

    async getHousehold(actor, id) {
      // Households name people outside a teacher's classes, so a teacher is refused them (assignedToClass: false).
      assertAllowed(actor, 'people:read', {
        assignedToClass: (await teacherScopeOf(classes, actor)) === null ? undefined : false,
      });
      const record = await people.getHousehold(actor.userId, actor.orgId, id);
      if (!record) {
        throw notFound('Household not found');
      }

      return (await toHouseholds(people, actor, [record], seesCustody(actor)))[0];
    },

    async listHouseholds(actor) {
      assertAllowed(actor, 'people:read', {
        assignedToClass: (await teacherScopeOf(classes, actor)) === null ? undefined : false,
      });

      return toHouseholds(people, actor, await people.listHouseholds(actor.userId, actor.orgId), seesCustody(actor));
    },
  };
}
