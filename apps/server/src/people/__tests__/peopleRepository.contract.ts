import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_SEARCH_RESULTS } from '@buxa/domain';
import { isHouseholdNotFound, isPersonNotFound } from '../PeopleRepository';
import { expectRejection, ISO_INSTANT, LOCAL_DATE, samplePerson, type RepositoryFactory, type RepositoryFixture } from './fixture';

/** One contract for every PeopleRepository adapter: the Postgres one and the in-memory one must pass the same tests. */
export function peopleRepositoryContract(factory: RepositoryFactory): void {
  describe('PeopleRepository contract', () => {
    let fx: RepositoryFixture;
    beforeEach(async () => { fx = await factory(); });
    afterEach(async () => { await fx.close(); });

    describe('create and get', () => {
      it('returns dates as YYYY-MM-DD and instants as ISO strings', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson({ dateOfBirth: '2014-03-09' }));
        expect(created.dateOfBirth).toMatch(LOCAL_DATE);
        expect(created.dateOfBirth).toBe('2014-03-09');
        expect(created.createdAt).toMatch(ISO_INSTANT);
        expect(created.archivedAt).toBeNull();
      });

      it('stores the roles sorted and the optional fields', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson({
          roles: ['guardian', 'camper'], preferredName: 'Ada', email: 'ada@example.test', phone: '+44 20 0000 0000',
        }));
        expect(created.roles).toEqual(['camper', 'guardian']);
        expect(created).toMatchObject({ preferredName: 'Ada', email: 'ada@example.test', phone: '+44 20 0000 0000', dateOfBirth: null });
      });

      it('reads back exactly what it created', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson());
        expect(await fx.repos.people.get(fx.actor.orgId, created.id)).toEqual(created);
      });

      it('returns null for an unknown or malformed id', async () => {
        expect(await fx.repos.people.get(fx.actor.orgId, randomUUID())).toBeNull();
        expect(await fx.repos.people.get(fx.actor.orgId, 'not-a-uuid')).toBeNull();
      });

      it('audits person.create', async () => {
        await fx.repos.people.create(fx.actor, samplePerson());
        expect(await fx.auditActions()).toEqual(['person.create']);
      });
    });

    describe('update and archive', () => {
      it('changes only the fields given and replaces roles when given', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['camper'] }));
        const updated = await fx.repos.people.update(fx.actor, created.id, { givenName: 'Augusta', roles: ['camper', 'participant'] });
        expect(updated).toMatchObject({ givenName: 'Augusta', familyName: 'Lovelace', roles: ['camper', 'participant'] });
        expect(updated.createdAt).toBe(created.createdAt);
      });

      it('can clear an optional field', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson({ phone: '+44 20 0000 0000' }));
        const updated = await fx.repos.people.update(fx.actor, created.id, { phone: null });
        expect(updated.phone).toBeNull();
      });

      it('throws PersonNotFoundError for an unknown id', async () => {
        await expectRejection(fx.repos.people.update(fx.actor, randomUUID(), { givenName: 'X' }), isPersonNotFound);
      });

      it('archive sets archivedAt once and keeps the first time', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson());
        const first = await fx.repos.people.archive(fx.actor, created.id, '2027-06-01T10:00:00.000Z');
        const second = await fx.repos.people.archive(fx.actor, created.id, '2027-07-01T10:00:00.000Z');
        expect(first.archivedAt).toBe('2027-06-01T10:00:00.000Z');
        expect(second.archivedAt).toBe(first.archivedAt);
      });

      it('audits update with the field names only, and archive', async () => {
        const created = await fx.repos.people.create(fx.actor, samplePerson());
        await fx.repos.people.update(fx.actor, created.id, { email: 'ada@example.test' });
        await fx.repos.people.archive(fx.actor, created.id, '2027-06-01T10:00:00.000Z');
        expect(await fx.auditActions()).toEqual(['person.create', 'person.update', 'person.archive']);
      });
    });

    describe('lists and search', () => {
      it('list orders by family name, then given name', async () => {
        await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Zed', familyName: 'Adams' }));
        await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Amy', familyName: 'Baker' }));
        await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Ben', familyName: 'Baker' }));
        const names = (await fx.repos.people.list(fx.actor.orgId, {})).map(p => `${p.familyName} ${p.givenName}`);
        expect(names).toEqual(['Adams Zed', 'Baker Amy', 'Baker Ben']);
      });

      it('list filters by role and hides archived people unless asked', async () => {
        const camper = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['camper'], familyName: 'Camper' }));
        await fx.repos.people.create(fx.actor, samplePerson({ roles: ['instructor'], familyName: 'Teacher' }));
        await fx.repos.people.archive(fx.actor, camper.id, '2027-06-01T10:00:00.000Z');
        expect((await fx.repos.people.list(fx.actor.orgId, { role: 'camper' }))).toHaveLength(0);
        expect((await fx.repos.people.list(fx.actor.orgId, { role: 'camper', includeArchived: true }))).toHaveLength(1);
        expect((await fx.repos.people.list(fx.actor.orgId, {})).map(p => p.familyName)).toEqual(['Teacher']);
        expect((await fx.repos.people.list(fx.actor.orgId, { includeArchived: true }))).toHaveLength(2);
      });

      it('getMany returns the requested people, in list order', async () => {
        const a = await fx.repos.people.create(fx.actor, samplePerson({ familyName: 'Adams' }));
        const b = await fx.repos.people.create(fx.actor, samplePerson({ familyName: 'Baker' }));
        await fx.repos.people.create(fx.actor, samplePerson({ familyName: 'Cole' }));
        const found = await fx.repos.people.getMany(fx.actor.orgId, [b.id, a.id, randomUUID(), 'nope']);
        expect(found.map(p => p.id)).toEqual([a.id, b.id]);
        expect(await fx.repos.people.getMany(fx.actor.orgId, [])).toEqual([]);
      });

      it('search is case- and accent-insensitive across given, family and preferred names', async () => {
        await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'José', familyName: 'García' }));
        await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Ann', familyName: 'Smith', preferredName: 'Zoë' }));
        const names = async (q: string) => (await fx.repos.people.search(fx.actor.orgId, q, 20)).map(p => p.givenName);
        expect(await names('jose')).toEqual(['José']);
        expect(await names('GARCIA')).toEqual(['José']);
        expect(await names('  josé   garcía ')).toEqual(['José']);
        expect(await names('zoe')).toEqual(['Ann']);
        expect(await names('ann smith')).toEqual(['Ann']);
        expect(await names('ann garcia')).toEqual([]);
        expect(await names('   ')).toEqual([]);
      });

      it('search hides archived people and respects the limit, capped at MAX_SEARCH_RESULTS', async () => {
        const archived = await fx.repos.people.create(fx.actor, samplePerson({ familyName: 'Hidden' }));
        await fx.repos.people.archive(fx.actor, archived.id, '2027-06-01T10:00:00.000Z');
        for (let i = 0; i < MAX_SEARCH_RESULTS + 3; i += 1) {
          await fx.repos.people.create(fx.actor, samplePerson({ givenName: `Kim${i}`, familyName: 'Kim' }));
        }
        expect(await fx.repos.people.search(fx.actor.orgId, 'hidden', 50)).toEqual([]);
        expect(await fx.repos.people.search(fx.actor.orgId, 'kim', 5)).toHaveLength(5);
        expect(await fx.repos.people.search(fx.actor.orgId, 'kim', 1000)).toHaveLength(MAX_SEARCH_RESULTS);
        expect(await fx.repos.people.search(fx.actor.orgId, 'kim', 0)).toEqual([]);
      });
    });

    describe('households', () => {
      it('creates a household, links members and reads them back', async () => {
        const parent = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['guardian'], familyName: 'Parent' }));
        const child = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['camper'], familyName: 'Child' }));
        const household = await fx.repos.people.createHousehold(fx.actor, 'The Lovelaces');
        expect(household.members).toEqual([]);
        await fx.repos.people.link(fx.actor, { householdId: household.id, personId: parent.id, relationship: 'mother', isGuardian: true, canPickup: true });
        const linked = await fx.repos.people.link(fx.actor, { householdId: household.id, personId: child.id, relationship: 'daughter', isGuardian: false, canPickup: false });
        expect(linked.members.map(m => m.personId).sort()).toEqual([parent.id, child.id].sort());
        expect(linked.members.find(m => m.personId === parent.id)).toMatchObject({ isGuardian: true, canPickup: true });
        expect(await fx.repos.people.getHousehold(fx.actor.orgId, household.id)).toEqual(linked);
        expect((await fx.repos.people.householdsOf(fx.actor.orgId, child.id)).map(h => h.id)).toEqual([household.id]);
      });

      it('create can join a new household in the same step, with the link flags', async () => {
        const parent = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['guardian'], familyName: 'Parent' }), {
          newHouseholdName: 'The Parents', relationship: 'mother', isGuardian: true, canPickup: false,
        });
        const households = await fx.repos.people.listHouseholds(fx.actor.orgId);
        expect(households).toHaveLength(1);
        expect(households[0]).toMatchObject({ name: 'The Parents', members: [{ personId: parent.id, relationship: 'mother', isGuardian: true, canPickup: false }] });
      });

      it('create can join an existing household', async () => {
        const household = await fx.repos.people.createHousehold(fx.actor, 'The Lovelaces');
        const child = await fx.repos.people.create(fx.actor, samplePerson({ roles: ['camper'] }), {
          householdId: household.id, relationship: 'daughter', isGuardian: false, canPickup: false,
        });
        expect((await fx.repos.people.getHousehold(fx.actor.orgId, household.id))?.members.map(m => m.personId)).toEqual([child.id]);
      });

      it('listHouseholds orders by name and includes the members', async () => {
        await fx.repos.people.createHousehold(fx.actor, 'Zeta');
        await fx.repos.people.createHousehold(fx.actor, 'Alpha');
        expect((await fx.repos.people.listHouseholds(fx.actor.orgId)).map(h => h.name)).toEqual(['Alpha', 'Zeta']);
        expect(await fx.repos.people.listHouseholds(fx.actor.orgId)).toHaveLength(2);
        expect(await fx.repos.people.listHouseholds(fx.otherActor.orgId)).toEqual([]);
      });

      it('link replaces the existing link for the same person', async () => {
        const person = await fx.repos.people.create(fx.actor, samplePerson());
        const household = await fx.repos.people.createHousehold(fx.actor, 'Home');
        await fx.repos.people.link(fx.actor, { householdId: household.id, personId: person.id, relationship: 'son', isGuardian: false, canPickup: false });
        const relinked = await fx.repos.people.link(fx.actor, { householdId: household.id, personId: person.id, relationship: 'guardian', isGuardian: true, canPickup: true });
        expect(relinked.members).toEqual([{ personId: person.id, relationship: 'guardian', isGuardian: true, canPickup: true }]);
      });

      it('unlink removes the link and returns the household', async () => {
        const person = await fx.repos.people.create(fx.actor, samplePerson());
        const household = await fx.repos.people.createHousehold(fx.actor, 'Home');
        await fx.repos.people.link(fx.actor, { householdId: household.id, personId: person.id, relationship: 'son', isGuardian: false, canPickup: false });
        const after = await fx.repos.people.unlink(fx.actor, household.id, person.id);
        expect(after.members).toEqual([]);
        expect(await fx.repos.people.householdsOf(fx.actor.orgId, person.id)).toEqual([]);
      });

      it('throws the household and person errors for unknown ids', async () => {
        const person = await fx.repos.people.create(fx.actor, samplePerson());
        const household = await fx.repos.people.createHousehold(fx.actor, 'Home');
        await expectRejection(
          fx.repos.people.link(fx.actor, { householdId: household.id, personId: randomUUID(), relationship: 'x', isGuardian: false, canPickup: false }),
          isPersonNotFound);
        await expectRejection(
          fx.repos.people.link(fx.actor, { householdId: randomUUID(), personId: person.id, relationship: 'x', isGuardian: false, canPickup: false }),
          isHouseholdNotFound);
        await expectRejection(fx.repos.people.unlink(fx.actor, randomUUID(), person.id), isHouseholdNotFound);
      });
    });

    describe('organisation isolation', () => {
      it('another organisation cannot read people, households or search results', async () => {
        const person = await fx.repos.people.create(fx.actor, samplePerson());
        const household = await fx.repos.people.createHousehold(fx.actor, 'Home');
        await fx.repos.people.link(fx.actor, { householdId: household.id, personId: person.id, relationship: 'son', isGuardian: false, canPickup: false });
        const other = fx.otherActor.orgId;
        expect(await fx.repos.people.get(other, person.id)).toBeNull();
        expect(await fx.repos.people.getMany(other, [person.id])).toEqual([]);
        expect(await fx.repos.people.list(other, { includeArchived: true })).toEqual([]);
        expect(await fx.repos.people.search(other, 'ada', 20)).toEqual([]);
        expect(await fx.repos.people.getHousehold(other, household.id)).toBeNull();
        expect(await fx.repos.people.householdsOf(other, person.id)).toEqual([]);
      });

      it('another organisation cannot change people or households, nor link across organisations', async () => {
        const person = await fx.repos.people.create(fx.actor, samplePerson());
        const household = await fx.repos.people.createHousehold(fx.actor, 'Home');
        await expectRejection(fx.repos.people.update(fx.otherActor, person.id, { givenName: 'X' }), isPersonNotFound);
        await expectRejection(fx.repos.people.archive(fx.otherActor, person.id, '2027-06-01T10:00:00.000Z'), isPersonNotFound);
        await expectRejection(
          fx.repos.people.link(fx.otherActor, { householdId: household.id, personId: person.id, relationship: 'x', isGuardian: false, canPickup: false }),
          isPersonNotFound);
        await expectRejection(fx.repos.people.unlink(fx.otherActor, household.id, person.id), isHouseholdNotFound);
        expect((await fx.repos.people.get(fx.actor.orgId, person.id))?.givenName).toBe('Ada');
      });
    });
  });
}
