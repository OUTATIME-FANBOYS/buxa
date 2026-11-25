import type {
  HouseholdLinkInput,
  NewPersonInput,
  Person,
  PersonListQuery,
  PersonPage,
  PersonPatchInput,
  PersonSummary,
} from '@buxa/contracts';
import { can, isMinor, isTeachingView, MAX_SEARCH_RESULTS, pageSpan, type Actor, type LocalDate } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { assignedTo, teacherScopeOf } from '../../classes/teacherScope';
import { badRequest, conflict, notFound } from '../../http/errors';
import type { MembershipRecord } from '../../memberships/MembershipRepository';
import type {
  HouseholdRecord,
  PersonHouseholdLink,
  PersonPatchRecord,
  PersonRecord,
} from '../../people/PeopleRepository';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toHouseholds, toPersonMembership, toSummary, onSiteByPerson } from '../shared/views';
import type { PeopleService, PeopleServiceDeps } from './PeopleService';
import { personPageFilter } from './personPageFilter';
import {
  CAMPER_NEEDS_GUARDIAN,
  CHOOSE_ROLE,
  isGuardianRole,
  PICKUP_NEEDS_GUARDIAN,
  RELATIONSHIP_NEEDED,
} from './rules';

/** Blank text means "no value" for the optional contact fields. */
const blankToNull = (value: string | null): string | null => (value === null || value.trim() === '' ? null : value);

/** An email is stored in lower case, so one address is one value (migration 0056 makes it unique in a camp). */
const emailOrNull = (value: string | null): string | null => {
  const email = blankToNull(value);

  return email === null ? null : email.trim().toLowerCase();
};

function toPatchRecord(patch: PersonPatchInput): PersonPatchRecord {
  const out: PersonPatchRecord = {};
  if (patch.givenName !== undefined) {
    out.givenName = patch.givenName;
  }
  if (patch.familyName !== undefined) {
    out.familyName = patch.familyName;
  }
  if (patch.dateOfBirth !== undefined) {
    out.dateOfBirth = patch.dateOfBirth;
  }
  if (patch.email !== undefined) {
    out.email = emailOrNull(patch.email);
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

  /** Puts a person back in the household they were in before an edit (or out of any, when there was none). Used only to undo. */
  async function restoreHousehold(actor: Actor, personId: string, before: HouseholdRecord | undefined): Promise<void> {
    const now = (await people.householdsOf(actor.userId, actor.orgId, personId))[0];
    if (now && now.id !== before?.id) {
      await people.unlink(actor, now.id, personId);
    }
    const member = before?.members.find(m => m.personId === personId);
    if (before && member) {
      await people.link(actor, {
        householdId: before.id,
        personId,
        relationship: member.relationship,
        isGuardian: member.isGuardian,
        canPickup: member.canPickup,
      });
    }
  }

  /** The list rows for these people: memberships, on-site state and access status, as far as the actor may see them. */
  async function summarise(actor: Actor, records: readonly PersonRecord[]): Promise<PersonSummary[]> {
    const [ms, onSite, today] = await Promise.all([
      memberships.forPeople(
        actor.userId,
        actor.orgId,
        records.map(p => p.id),
      ),
      onSiteByPerson(attendance, actor),
      todayFor(actor),
    ]);
    const groups = byPerson(ms);
    const custody = seesCustody(actor);

    return records.map(p => toSummary(p, groups.get(p.id) ?? [], onSite.has(p.id), today, custody));
  }

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
      households: isTeachingView(actor) ? [] : await toHouseholds(people, actor, households, custody),
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

  /**
   * Refuses (409) to take a guardian out of a household when that leaves campers in it with no guardian. Read-only, so callers can
   * run it before they write.
   */
  async function assertCanLeave(
    actor: Pick<Actor, 'userId' | 'orgId'>,
    household: HouseholdRecord,
    personId: string,
  ): Promise<void> {
    const removed = household.members.find(m => m.personId === personId);
    if (!removed?.isGuardian) {
      return;
    }
    const others = household.members.filter(m => m.personId !== personId);
    if (others.some(m => m.isGuardian)) {
      return;
    }
    const companions = await people.getMany(
      actor.userId,
      actor.orgId,
      others.map(m => m.personId),
    );
    if (companions.some(p => p.roles.includes('camper'))) {
      throw conflict('A camper needs a parent or guardian in this household. Link another guardian first.');
    }
  }

  const service: PeopleService = {
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

      return summarise(actor, records);
    },

    async listPage(actor, query = {}): Promise<PersonPage> {
      const scope = await teacherScopeOf(classes, actor);
      assertAllowed(actor, 'people:read', { assignedToClass: scope === null ? undefined : true });
      const filter = personPageFilter(query, scope);
      // The count and the page read the same filter, so the total counts every match, not only the rows on this page.
      const total = await people.countPeople(actor.userId, actor.orgId, filter);
      const span = pageSpan(total, query.page ?? 1, query.pageSize);
      const records = total === 0 ? [] : await people.listPeoplePage(actor.userId, actor.orgId, filter, span);

      return {
        people: await summarise(actor, records),
        total,
        page: span.page,
        pageSize: span.pageSize,
        pageCount: span.pageCount,
        from: span.from,
        to: span.to,
      };
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
            dateOfBirth: input.dateOfBirth ?? null,
            email: emailOrNull(input.email ?? null),
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

    async updateWithHousehold(actor, id, patch, household) {
      if (household === undefined) {
        return service.update(actor, id, patch);
      }
      // The household moves first, so a refused household change (a camper's guardian rule, 400 or 409) saves nothing.
      const before = (await people.householdsOf(actor.userId, actor.orgId, id))[0];
      await service.setHousehold(actor, id, household, patch.roles);
      try {
        return await service.update(actor, id, patch);
      } catch (error) {
        // The details were refused after the household moved: put the household back, then report the original refusal.
        await restoreHousehold(actor, id, before);
        throw error;
      }
    },

    async erase(actor, id) {
      assertAllowed(actor, 'data:erase');
      if (!(await people.get(actor.userId, actor.orgId, id))) {
        throw notFound('Person not found');
      }
      await guard(() => people.erase(actor, id));
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
      await assertCanLeave(actor, household, personId);
      const record = await guard(() => people.unlink(actor, householdId, personId));

      return (await toHouseholds(people, actor, [record], seesCustody(actor)))[0];
    },

    async setHousehold(actor, personId, input, roles) {
      assertAllowed(actor, 'people:update');
      const orgId = actor.orgId;
      const record = await people.get(actor.userId, orgId, personId);
      if (!record) {
        throw notFound('Person not found');
      }
      const finalRoles = roles ?? record.roles;
      const camper = finalRoles.includes('camper');
      const newName = input.newHouseholdName?.trim() ?? '';
      if (input.householdId !== undefined && newName !== '') {
        throw badRequest('Choose an existing household or name a new one, not both.');
      }
      const current: HouseholdRecord | undefined = (await people.householdsOf(actor.userId, orgId, personId))[0];

      if (input.householdId === undefined && newName === '') {
        // Neither an existing household nor a name: the person leaves the household they are in.
        if (!current) {
          return;
        }
        if (camper) {
          throw badRequest(CAMPER_NEEDS_GUARDIAN);
        }
        await assertCanLeave(actor, current, personId);
        await guard(() => people.unlink(actor, current.id, personId));

        return;
      }

      if (current && input.householdId === current.id) {
        // Still in the same household: only the relationship can change, and only if one is given.
        const member = current.members.find(m => m.personId === personId);
        const relationship = input.relationship?.trim() ?? '';
        if (relationship === '' || relationship === member?.relationship) {
          return;
        }
        if (member?.canPickup) {
          assertAllowed(actor, 'people:authorise_pickup');
        }
        await guard(() =>
          people.link(actor, {
            householdId: current.id,
            personId,
            relationship,
            isGuardian: member?.isGuardian ?? isGuardianRole(finalRoles),
            canPickup: member?.canPickup ?? false,
          }),
        );

        return;
      }

      // Joining a household: an existing one, or a new one with this name. Everything is checked before anything is written.
      const relationship = requireRelationship(input.relationship);
      let existingId: string | undefined;
      if (input.householdId !== undefined) {
        const target = await people.getHousehold(actor.userId, orgId, input.householdId);
        if (!target) {
          throw badRequest('That household does not exist.');
        }
        if (camper && !target.members.some(m => m.personId !== personId && m.isGuardian)) {
          throw badRequest(CAMPER_NEEDS_GUARDIAN);
        }
        existingId = target.id;
      } else {
        assertAllowed(actor, 'people:create');
        if (camper) {
          throw badRequest(CAMPER_NEEDS_GUARDIAN);
        }
      }
      if (current) {
        await assertCanLeave(actor, current, personId);
      }
      const householdId = existingId ?? (await guard(() => people.createHousehold(actor, newName))).id;
      // A move does not carry pick-up authority over: the person is linked afresh, and pick-up needs its own grant.
      await guard(() =>
        people.link(actor, {
          householdId,
          personId,
          relationship,
          isGuardian: isGuardianRole(finalRoles),
          canPickup: false,
        }),
      );
      if (current) {
        await guard(() => people.unlink(actor, current.id, personId));
      }
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

  return service;
}
