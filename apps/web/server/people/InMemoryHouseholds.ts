import type { Actor } from '@buxa/domain';
import { HouseholdNotFoundError, PersonNotFoundError, type HouseholdLinkRecord, type HouseholdRecord } from './PeopleRepository';
import { compareText, newId, type InMemoryDatabase, type StoredHousehold } from './InMemoryDatabase';

const toRecord = (h: StoredHousehold): HouseholdRecord => ({
  id: h.id,
  name: h.name,
  members: [...h.members]
    .sort(([a], [b]) => compareText(a, b))
    .map(([personId, m]) => ({ personId, relationship: m.relationship, isGuardian: m.isGuardian, canPickup: m.canPickup })),
});

/** Household half of the in-memory people adapter. Mirrors PgHouseholds: same errors, same audit actions, same ordering. */
export class InMemoryHouseholds {
  constructor(private readonly db: InMemoryDatabase) {}

  create(actor: Actor, name: string): HouseholdRecord {
    const household: StoredHousehold = { id: newId(), orgId: actor.orgId, name, members: new Map() };
    this.db.households.set(household.id, household);
    this.db.record(actor, 'household.create', 'household', household.id);
    return toRecord(household);
  }

  get(orgId: string, id: string): HouseholdRecord | null {
    const household = this.db.inOrg(this.db.households, orgId, id);
    return household ? toRecord(household) : null;
  }

  householdsOf(orgId: string, personId: string): HouseholdRecord[] {
    return [...this.db.households.values()]
      .filter(h => h.orgId === orgId && h.members.has(personId))
      .sort((a, b) => compareText(a.name, b.name) || compareText(a.id, b.id))
      .map(toRecord);
  }

  link(actor: Actor, link: HouseholdLinkRecord): HouseholdRecord {
    if (!this.db.inOrg(this.db.people, actor.orgId, link.personId)) throw new PersonNotFoundError();
    const household = this.require(actor.orgId, link.householdId);
    household.members.set(link.personId, { relationship: link.relationship, isGuardian: link.isGuardian, canPickup: link.canPickup });
    this.db.record(actor, 'household.update', 'household', link.householdId, { personId: link.personId });
    return toRecord(household);
  }

  unlink(actor: Actor, householdId: string, personId: string): HouseholdRecord {
    const household = this.require(actor.orgId, householdId);
    if (household.members.delete(personId)) {
      this.db.record(actor, 'household.update', 'household', householdId, { personId });
    }
    return toRecord(household);
  }

  private require(orgId: string, id: string): StoredHousehold {
    const household = this.db.inOrg(this.db.households, orgId, id);
    if (!household) throw new HouseholdNotFoundError();
    return household;
  }
}
