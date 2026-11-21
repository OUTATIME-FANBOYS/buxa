import { matchesName, MAX_SEARCH_RESULTS, normalizeForSearch, type Actor, type CampRole, settle } from '@buxa/domain';
import {
  PersonNotFoundError,
  type HouseholdLinkRecord,
  type HouseholdRecord,
  type NewPersonRecord,
  type PeopleRepository,
  type PersonFilter,
  type PersonHouseholdLink,
  type PersonPageFilter,
  type PersonPatchRecord,
  type PersonRecord,
} from './PeopleRepository';
import { compareText, newId, instant, type InMemoryDatabase, type StoredPerson } from './InMemoryDatabase';
import { InMemoryHouseholds } from './InMemoryHouseholds';

const sortRoles = (roles: readonly CampRole[]): CampRole[] => [...roles].sort(compareText);

/** Same order as the Postgres adapter: family name, given name, then id, all compared case-insensitively. */
export function comparePeople(a: StoredPerson, b: StoredPerson): number {
  return (
    compareText(a.familyName.toLowerCase(), b.familyName.toLowerCase()) ||
    compareText(a.givenName.toLowerCase(), b.givenName.toLowerCase()) ||
    compareText(a.id, b.id)
  );
}

const toRecord = (p: StoredPerson): PersonRecord => ({
  id: p.id,
  givenName: p.givenName,
  familyName: p.familyName,
  preferredName: p.preferredName,
  dateOfBirth: p.dateOfBirth,
  email: p.email,
  phone: p.phone,
  roles: [...p.roles],
  archivedAt: p.archivedAt,
  createdAt: p.createdAt,
});

/** Applies the present fields and returns their names in the same fixed order the Postgres adapter reports them. */
function applyPatch(person: StoredPerson, patch: PersonPatchRecord): string[] {
  const changed: string[] = [];
  if (patch.givenName !== undefined) {
    person.givenName = patch.givenName;
    changed.push('givenName');
  }
  if (patch.familyName !== undefined) {
    person.familyName = patch.familyName;
    changed.push('familyName');
  }
  if (patch.preferredName !== undefined) {
    person.preferredName = patch.preferredName;
    changed.push('preferredName');
  }
  if (patch.dateOfBirth !== undefined) {
    person.dateOfBirth = patch.dateOfBirth;
    changed.push('dateOfBirth');
  }
  if (patch.email !== undefined) {
    person.email = patch.email;
    changed.push('email');
  }
  if (patch.phone !== undefined) {
    person.phone = patch.phone;
    changed.push('phone');
  }
  if (patch.roles !== undefined) {
    person.roles = sortRoles(patch.roles);
    changed.push('roles');
  }

  return changed;
}

/** In-memory adapter: the second implementation of PeopleRepository, checked against the same contract tests as Postgres. */
export class InMemoryPeopleRepository implements PeopleRepository {
  private readonly households: InMemoryHouseholds;

  constructor(private readonly db: InMemoryDatabase) {
    this.households = new InMemoryHouseholds(db);
  }

  create(actor: Actor, input: NewPersonRecord, household?: PersonHouseholdLink): Promise<PersonRecord> {
    return settle(() => {
      const person: StoredPerson = {
        id: newId(),
        orgId: actor.orgId,
        givenName: input.givenName,
        familyName: input.familyName,
        preferredName: input.preferredName,
        dateOfBirth: input.dateOfBirth,
        email: input.email,
        phone: input.phone,
        roles: sortRoles(input.roles),
        archivedAt: null,
        createdAt: new Date().toISOString(),
      };
      this.db.people.set(person.id, person);
      this.db.record(actor, 'person.create', 'person', person.id);
      if (household) {
        const householdId =
          household.householdId !== undefined
            ? household.householdId
            : this.households.create(actor, household.newHouseholdName).id;
        this.households.link(actor, {
          householdId,
          personId: person.id,
          relationship: household.relationship,
          isGuardian: household.isGuardian,
          canPickup: household.canPickup,
        });
      }

      return toRecord(person);
    });
  }

  update(actor: Actor, id: string, patch: PersonPatchRecord): Promise<PersonRecord> {
    return settle(() => {
      const person = this.require(actor.orgId, id);
      const fields = applyPatch(person, patch);
      this.db.record(actor, 'person.update', 'person', id, { fields });

      return toRecord(person);
    });
  }

  erase(actor: Actor, id: string): Promise<void> {
    return settle(() => {
      this.require(actor.orgId, id);
      for (const [key, row] of this.db.memberships) {
        if (row.orgId === actor.orgId && row.personId === id) this.db.memberships.delete(key);
      }
      for (const [key, row] of this.db.credentials) {
        if (row.orgId === actor.orgId && row.personId === id) this.db.credentials.delete(key);
      }
      for (const [key, row] of this.db.checkIns) {
        if (row.orgId === actor.orgId && row.personId === id) this.db.checkIns.delete(key);
      }
      this.db.people.delete(id);
      this.db.record(actor, 'person.delete', 'person', id);
    });
  }

  archive(actor: Actor, id: string, at: string): Promise<PersonRecord> {
    return settle(() => {
      const person = this.require(actor.orgId, id);
      if (person.archivedAt === null) {
        person.archivedAt = instant(at);
        this.db.record(actor, 'person.archive', 'person', id);
      }

      return toRecord(person);
    });
  }

  get(userId: string, orgId: string, id: string): Promise<PersonRecord | null> {
    return settle(() => {
      const person = this.db.inOrg(this.db.people, orgId, id);

      return person ? toRecord(person) : null;
    });
  }

  getMany(userId: string, orgId: string, ids: readonly string[]): Promise<PersonRecord[]> {
    return settle(() => {
      return this.visible(orgId, p => ids.includes(p.id));
    });
  }

  list(userId: string, orgId: string, filter: PersonFilter): Promise<PersonRecord[]> {
    return settle(() => {
      return this.visible(
        orgId,
        p =>
          (filter.includeArchived === true || p.archivedAt === null) &&
          (filter.role === undefined || p.roles.includes(filter.role)),
      );
    });
  }

  search(userId: string, orgId: string, query: string, limit: number): Promise<PersonRecord[]> {
    return settle(() => {
      const max = Math.min(Math.max(0, Math.floor(limit)), MAX_SEARCH_RESULTS);
      if (normalizeForSearch(query) === '' || max === 0) {
        return [];
      }
      const found = this.visible(orgId, p => p.archivedAt === null && matchesName(p, query));

      return found.slice(0, max);
    });
  }

  countPeople(userId: string, orgId: string, filter: PersonPageFilter): Promise<number> {
    return settle(() => this.pageMatches(orgId, filter).length);
  }

  listPeoplePage(
    userId: string,
    orgId: string,
    filter: PersonPageFilter,
    window: { offset: number; limit: number },
  ): Promise<PersonRecord[]> {
    return settle(() => this.pageMatches(orgId, filter).slice(window.offset, window.offset + window.limit));
  }

  createHousehold(actor: Actor, name: string): Promise<HouseholdRecord> {
    return settle(() => {
      return this.households.create(actor, name);
    });
  }

  getHousehold(userId: string, orgId: string, id: string): Promise<HouseholdRecord | null> {
    return settle(() => {
      return this.households.get(orgId, id);
    });
  }

  listHouseholds(userId: string, orgId: string): Promise<HouseholdRecord[]> {
    return settle(() => {
      return this.households.list(orgId);
    });
  }

  householdsOf(userId: string, orgId: string, personId: string): Promise<HouseholdRecord[]> {
    return settle(() => {
      return this.households.householdsOf(orgId, personId);
    });
  }

  link(actor: Actor, link: HouseholdLinkRecord): Promise<HouseholdRecord> {
    return settle(() => {
      return this.households.link(actor, link);
    });
  }

  unlink(actor: Actor, householdId: string, personId: string): Promise<HouseholdRecord> {
    return settle(() => {
      return this.households.unlink(actor, householdId, personId);
    });
  }

  private require(orgId: string, id: string): StoredPerson {
    const person = this.db.inOrg(this.db.people, orgId, id);
    if (!person) {
      throw new PersonNotFoundError();
    }

    return person;
  }

  /** Every person the page filter keeps, in list order. The Postgres WHERE clause in PgPersonQueries mirrors this. */
  private pageMatches(orgId: string, filter: PersonPageFilter): PersonRecord[] {
    const hasTerm = normalizeForSearch(filter.term) !== '';

    return this.visible(
      orgId,
      p =>
        (filter.includeArchived === true || p.archivedAt === null) &&
        (filter.role === undefined || p.roles.includes(filter.role)) &&
        (filter.ids === undefined || filter.ids.includes(p.id)) &&
        (!hasTerm || matchesName(p, filter.term)),
    );
  }

  private visible(orgId: string, keep: (p: StoredPerson) => boolean): PersonRecord[] {
    return [...this.db.people.values()]
      .filter(p => p.orgId === orgId && keep(p))
      .sort(comparePeople)
      .map(toRecord);
  }
}
