import { matchesName, MAX_SEARCH_RESULTS, normalizeForSearch, type Actor, type CampRole } from '@buxa/domain';
import { PersonNotFoundError, type HouseholdLinkRecord, type HouseholdRecord, type NewPersonRecord, type PeopleRepository, type PersonFilter, type PersonHouseholdLink, type PersonPatchRecord, type PersonRecord } from './PeopleRepository';
import { compareText, newId, instant, type InMemoryDatabase, type StoredPerson } from './InMemoryDatabase';
import { InMemoryHouseholds } from './InMemoryHouseholds';

const sortRoles = (roles: readonly CampRole[]): CampRole[] => [...roles].sort(compareText);

/** Same order as the Postgres adapter: family name, given name, then id, all compared case-insensitively. */
export function comparePeople(a: StoredPerson, b: StoredPerson): number {
  return compareText(a.familyName.toLowerCase(), b.familyName.toLowerCase())
    || compareText(a.givenName.toLowerCase(), b.givenName.toLowerCase())
    || compareText(a.id, b.id);
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
  if (patch.givenName !== undefined) { person.givenName = patch.givenName; changed.push('givenName'); }
  if (patch.familyName !== undefined) { person.familyName = patch.familyName; changed.push('familyName'); }
  if (patch.preferredName !== undefined) { person.preferredName = patch.preferredName; changed.push('preferredName'); }
  if (patch.dateOfBirth !== undefined) { person.dateOfBirth = patch.dateOfBirth; changed.push('dateOfBirth'); }
  if (patch.email !== undefined) { person.email = patch.email; changed.push('email'); }
  if (patch.phone !== undefined) { person.phone = patch.phone; changed.push('phone'); }
  if (patch.roles !== undefined) { person.roles = sortRoles(patch.roles); changed.push('roles'); }
  return changed;
}

/** In-memory adapter: the second implementation of PeopleRepository, checked against the same contract tests as Postgres. */
export class InMemoryPeopleRepository implements PeopleRepository {
  private readonly households: InMemoryHouseholds;

  constructor(private readonly db: InMemoryDatabase) {
    this.households = new InMemoryHouseholds(db);
  }

  async create(actor: Actor, input: NewPersonRecord, household?: PersonHouseholdLink): Promise<PersonRecord> {
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
      const householdId = household.householdId !== undefined ? household.householdId : this.households.create(actor, household.newHouseholdName).id;
      this.households.link(actor, { householdId, personId: person.id, relationship: household.relationship, isGuardian: household.isGuardian, canPickup: household.canPickup });
    }
    return toRecord(person);
  }

  async update(actor: Actor, id: string, patch: PersonPatchRecord): Promise<PersonRecord> {
    const person = this.require(actor.orgId, id);
    const fields = applyPatch(person, patch);
    this.db.record(actor, 'person.update', 'person', id, { fields });
    return toRecord(person);
  }

  async archive(actor: Actor, id: string, at: string): Promise<PersonRecord> {
    const person = this.require(actor.orgId, id);
    if (person.archivedAt === null) {
      person.archivedAt = instant(at);
      this.db.record(actor, 'person.archive', 'person', id);
    }
    return toRecord(person);
  }

  async get(orgId: string, id: string): Promise<PersonRecord | null> {
    const person = this.db.inOrg(this.db.people, orgId, id);
    return person ? toRecord(person) : null;
  }

  async getMany(orgId: string, ids: readonly string[]): Promise<PersonRecord[]> {
    return this.visible(orgId, p => ids.includes(p.id));
  }

  async list(orgId: string, filter: PersonFilter): Promise<PersonRecord[]> {
    return this.visible(orgId, p =>
      (filter.includeArchived === true || p.archivedAt === null) && (filter.role === undefined || p.roles.includes(filter.role)));
  }

  async search(orgId: string, query: string, limit: number): Promise<PersonRecord[]> {
    const max = Math.min(Math.max(0, Math.floor(limit)), MAX_SEARCH_RESULTS);
    if (normalizeForSearch(query) === '' || max === 0) return [];
    const found = this.visible(orgId, p => p.archivedAt === null && matchesName(p, query));
    return found.slice(0, max);
  }

  async createHousehold(actor: Actor, name: string): Promise<HouseholdRecord> {
    return this.households.create(actor, name);
  }

  async getHousehold(orgId: string, id: string): Promise<HouseholdRecord | null> {
    return this.households.get(orgId, id);
  }

  async listHouseholds(orgId: string): Promise<HouseholdRecord[]> {
    return this.households.list(orgId);
  }

  async householdsOf(orgId: string, personId: string): Promise<HouseholdRecord[]> {
    return this.households.householdsOf(orgId, personId);
  }

  async link(actor: Actor, link: HouseholdLinkRecord): Promise<HouseholdRecord> {
    return this.households.link(actor, link);
  }

  async unlink(actor: Actor, householdId: string, personId: string): Promise<HouseholdRecord> {
    return this.households.unlink(actor, householdId, personId);
  }

  private require(orgId: string, id: string): StoredPerson {
    const person = this.db.inOrg(this.db.people, orgId, id);
    if (!person) throw new PersonNotFoundError();
    return person;
  }

  private visible(orgId: string, keep: (p: StoredPerson) => boolean): PersonRecord[] {
    return [...this.db.people.values()]
      .filter(p => p.orgId === orgId && keep(p))
      .sort(comparePeople)
      .map(toRecord);
  }
}
