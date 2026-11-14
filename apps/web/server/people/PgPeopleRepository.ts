import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import type { HouseholdLinkRecord, HouseholdRecord, NewPersonRecord, PeopleRepository, PersonFilter, PersonHouseholdLink, PersonPatchRecord, PersonRecord } from './PeopleRepository';
import { deleteMember, getHousehold, householdsOf, insertHousehold, listHouseholds, requireHousehold, upsertMember } from './PgHouseholds';
import { getPeople, getPerson, listPeople, requirePerson, searchPeople } from './PgPersonQueries';
import { insertPerson, updatePerson } from './PgPersonWrites';

/** Postgres adapter. Each call runs in withOrg (row-level security) and writes its audit entry in the same transaction. */
export class PgPeopleRepository implements PeopleRepository {
  constructor(private readonly pool: Pool) {}

  create(actor: Actor, input: NewPersonRecord, household?: PersonHouseholdLink): Promise<PersonRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      const id = await insertPerson(db, actor.orgId, input);
      await recordAudit(db, { actor, action: 'person.create', entity: 'person', entityId: id });
      if (household) {
        let householdId: string;
        if (household.householdId !== undefined) {
          householdId = household.householdId;
        } else {
          householdId = await insertHousehold(db, actor.orgId, household.newHouseholdName);
          await recordAudit(db, { actor, action: 'household.create', entity: 'household', entityId: householdId });
        }
        await upsertMember(db, actor.orgId, { householdId, personId: id, relationship: household.relationship, isGuardian: household.isGuardian, canPickup: household.canPickup });
        await recordAudit(db, { actor, action: 'household.update', entity: 'household', entityId: householdId, data: { personId: id } });
      }
      return requirePerson(db, id);
    });
  }

  update(actor: Actor, id: string, patch: PersonPatchRecord): Promise<PersonRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requirePerson(db, id);
      const fields = await updatePerson(db, actor.orgId, id, patch);
      await recordAudit(db, { actor, action: 'person.update', entity: 'person', entityId: id, data: { fields } });
      return requirePerson(db, id);
    });
  }

  archive(actor: Actor, id: string, at: string): Promise<PersonRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      const person = await requirePerson(db, id);
      if (person.archivedAt !== null) return person;
      await db.query('UPDATE people SET archived_at = $2::timestamptz WHERE id = $1', [id, at]);
      await recordAudit(db, { actor, action: 'person.archive', entity: 'person', entityId: id });
      return requirePerson(db, id);
    });
  }

  get(orgId: string, id: string): Promise<PersonRecord | null> {
    return withOrg(this.pool, orgId, db => getPerson(db, id));
  }

  getMany(orgId: string, ids: readonly string[]): Promise<PersonRecord[]> {
    return withOrg(this.pool, orgId, db => getPeople(db, ids));
  }

  list(orgId: string, filter: PersonFilter): Promise<PersonRecord[]> {
    return withOrg(this.pool, orgId, db => listPeople(db, filter));
  }

  search(orgId: string, query: string, limit: number): Promise<PersonRecord[]> {
    return withOrg(this.pool, orgId, db => searchPeople(db, query, limit));
  }

  createHousehold(actor: Actor, name: string): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      const id = await insertHousehold(db, actor.orgId, name);
      await recordAudit(db, { actor, action: 'household.create', entity: 'household', entityId: id });
      return requireHousehold(db, id);
    });
  }

  getHousehold(orgId: string, id: string): Promise<HouseholdRecord | null> {
    return withOrg(this.pool, orgId, db => getHousehold(db, id));
  }

  listHouseholds(orgId: string): Promise<HouseholdRecord[]> {
    return withOrg(this.pool, orgId, db => listHouseholds(db));
  }

  householdsOf(orgId: string, personId: string): Promise<HouseholdRecord[]> {
    return withOrg(this.pool, orgId, db => householdsOf(db, personId));
  }

  link(actor: Actor, link: HouseholdLinkRecord): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requirePerson(db, link.personId);
      await requireHousehold(db, link.householdId);
      await upsertMember(db, actor.orgId, link);
      await recordAudit(db, { actor, action: 'household.update', entity: 'household', entityId: link.householdId, data: { personId: link.personId } });
      return requireHousehold(db, link.householdId);
    });
  }

  unlink(actor: Actor, householdId: string, personId: string): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requireHousehold(db, householdId);
      const removed = isUuid(personId) && (await deleteMember(db, householdId, personId));
      if (removed) await recordAudit(db, { actor, action: 'household.update', entity: 'household', entityId: householdId, data: { personId } });
      return requireHousehold(db, householdId);
    });
  }
}
