import type { Pool } from 'pg';
import { errorMessage, withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { recordAudit } from '../audit/recordAudit';
import { PersonNotFoundError } from './PeopleRepository';
import { forbidden } from '../http/errors';
import type {
  HouseholdLinkRecord,
  HouseholdRecord,
  NewPersonRecord,
  PeopleRepository,
  PersonFilter,
  PersonHouseholdLink,
  PersonPageFilter,
  PersonPatchRecord,
  PersonRecord,
} from './PeopleRepository';
import {
  deleteMember,
  getHousehold,
  householdsOf,
  insertHousehold,
  listHouseholds,
  requireHousehold,
  upsertMember,
} from './PgHouseholds';
import {
  countPeople,
  getPeople,
  getPerson,
  listPeople,
  listPeoplePage,
  peopleByEmail,
  requirePerson,
  searchPeople,
} from './PgPersonQueries';
import { insertPerson, updatePerson } from './PgPersonWrites';

/** Postgres adapter. Each call runs in withOrg (row-level security) and writes its audit entry in the same transaction. */
export class PgPeopleRepository implements PeopleRepository {
  constructor(private readonly pool: Pool) {}

  create(actor: Actor, input: NewPersonRecord, household?: PersonHouseholdLink): Promise<PersonRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
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
        await upsertMember(db, actor.orgId, {
          householdId,
          personId: id,
          relationship: household.relationship,
          isGuardian: household.isGuardian,
          canPickup: household.canPickup,
        });
        await recordAudit(db, {
          actor,
          action: 'household.update',
          entity: 'household',
          entityId: householdId,
          data: { personId: id },
        });
      }

      return requirePerson(db, id);
    });
  }

  update(actor: Actor, id: string, patch: PersonPatchRecord): Promise<PersonRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await requirePerson(db, id);
      const fields = await updatePerson(db, actor.orgId, id, patch);
      await recordAudit(db, { actor, action: 'person.update', entity: 'person', entityId: id, data: { fields } });

      return requirePerson(db, id);
    });
  }

  archive(actor: Actor, id: string, at: string): Promise<PersonRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const person = await requirePerson(db, id);
      if (person.archivedAt !== null) {
        return person;
      }
      await db.query('UPDATE people SET archived_at = $2::timestamptz WHERE id = $1', [id, at]);
      await recordAudit(db, { actor, action: 'person.archive', entity: 'person', entityId: id });

      return requirePerson(db, id);
    });
  }

  /** buxa_delete_person (migration 0040) checks the owner, removes the person and their pending invites, and audits, in one statement. */
  async erase(actor: Actor, id: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, db =>
        db.query('SELECT buxa_delete_person($1, $2)', [actor.orgId, id]),
      );
    } catch (error) {
      throw mapEraseError(error);
    }
  }

  get(userId: string, orgId: string, id: string): Promise<PersonRecord | null> {
    return withOrg(this.pool, userId, orgId, db => getPerson(db, id));
  }

  byEmail(userId: string, orgId: string, email: string): Promise<PersonRecord[]> {
    return withOrg(this.pool, userId, orgId, db => peopleByEmail(db, email));
  }

  getMany(userId: string, orgId: string, ids: readonly string[]): Promise<PersonRecord[]> {
    return withOrg(this.pool, userId, orgId, db => getPeople(db, ids));
  }

  list(userId: string, orgId: string, filter: PersonFilter): Promise<PersonRecord[]> {
    return withOrg(this.pool, userId, orgId, db => listPeople(db, filter));
  }

  search(userId: string, orgId: string, query: string, limit: number): Promise<PersonRecord[]> {
    return withOrg(this.pool, userId, orgId, db => searchPeople(db, query, limit));
  }

  countPeople(userId: string, orgId: string, filter: PersonPageFilter): Promise<number> {
    return withOrg(this.pool, userId, orgId, db => countPeople(db, filter));
  }

  listPeoplePage(
    userId: string,
    orgId: string,
    filter: PersonPageFilter,
    window: { offset: number; limit: number },
  ): Promise<PersonRecord[]> {
    return withOrg(this.pool, userId, orgId, db => listPeoplePage(db, filter, window));
  }

  createHousehold(actor: Actor, name: string): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const id = await insertHousehold(db, actor.orgId, name);
      await recordAudit(db, { actor, action: 'household.create', entity: 'household', entityId: id });

      return requireHousehold(db, id);
    });
  }

  getHousehold(userId: string, orgId: string, id: string): Promise<HouseholdRecord | null> {
    return withOrg(this.pool, userId, orgId, db => getHousehold(db, id));
  }

  listHouseholds(userId: string, orgId: string): Promise<HouseholdRecord[]> {
    return withOrg(this.pool, userId, orgId, db => listHouseholds(db));
  }

  householdsOf(userId: string, orgId: string, personId: string): Promise<HouseholdRecord[]> {
    return withOrg(this.pool, userId, orgId, db => householdsOf(db, personId));
  }

  link(actor: Actor, link: HouseholdLinkRecord): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await requirePerson(db, link.personId);
      await requireHousehold(db, link.householdId);
      await upsertMember(db, actor.orgId, link);
      await recordAudit(db, {
        actor,
        action: 'household.update',
        entity: 'household',
        entityId: link.householdId,
        data: { personId: link.personId, isGuardian: link.isGuardian, canPickup: link.canPickup },
      });

      return requireHousehold(db, link.householdId);
    });
  }

  unlink(actor: Actor, householdId: string, personId: string): Promise<HouseholdRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await requireHousehold(db, householdId);
      const removed = isUuid(personId) && (await deleteMember(db, householdId, personId));
      if (removed) {
        await recordAudit(db, {
          actor,
          action: 'household.update',
          entity: 'household',
          entityId: householdId,
          data: { personId },
        });
      }

      return requireHousehold(db, householdId);
    });
  }
}

/** A database refusal becomes the error the service and the app already understand: 403 for the owner rule, 404 for no person. */
function mapEraseError(error: unknown): unknown {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '42501') {
    return forbidden(errorMessage(error));
  }
  if (code === 'P0002') {
    return new PersonNotFoundError();
  }

  return error;
}
