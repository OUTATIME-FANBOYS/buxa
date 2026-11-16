import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isMembershipNotFound } from '../MembershipRepository';
import { isPersonNotFound } from '../../people/PeopleRepository';
import { expectRejection, ISO_INSTANT, LOCAL_DATE, samplePerson, type RepositoryFactory, type RepositoryFixture } from '../../people/__tests__/fixture';

/** One contract for every MembershipRepository adapter. */
export function membershipRepositoryContract(factory: RepositoryFactory): void {
  describe('MembershipRepository contract', () => {
    let fx: RepositoryFixture;
    beforeEach(async () => { fx = await factory(); });
    afterEach(async () => { await fx.close(); });

    const newPerson = async (): Promise<string> => (await fx.repos.people.create(fx.actor, samplePerson())).id;
    const summer = (personId: string) => ({ personId, plan: 'Summer 2027', startsOn: '2027-06-01', endsOn: '2027-08-31' });

    it('adds a membership with dates as YYYY-MM-DD and no revocation', async () => {
      const personId = await newPerson();
      const membership = await fx.repos.memberships.add(fx.actor, summer(personId));
      expect(membership).toEqual({
        id: membership.id, personId, plan: 'Summer 2027', startsOn: '2027-06-01', endsOn: '2027-08-31', revokedAt: null, revokedReason: null,
      });
      expect(membership.startsOn).toMatch(LOCAL_DATE);
    });

    it('throws PersonNotFoundError for an unknown person, or one of another organisation', async () => {
      await expectRejection(fx.repos.memberships.add(fx.actor, summer(randomUUID())), isPersonNotFound);
      const otherPerson = (await fx.repos.people.create(fx.otherActor, samplePerson())).id;
      await expectRejection(fx.repos.memberships.add(fx.actor, summer(otherPerson)), isPersonNotFound);
    });

    it('forPerson returns the person\'s memberships, oldest start first', async () => {
      const personId = await newPerson();
      const other = await newPerson();
      const winter = await fx.repos.memberships.add(fx.actor, { personId, plan: 'Winter', startsOn: '2026-12-01', endsOn: '2027-02-28' });
      const summerRow = await fx.repos.memberships.add(fx.actor, summer(personId));
      await fx.repos.memberships.add(fx.actor, summer(other));
      expect((await fx.repos.memberships.forPerson(fx.actor.orgId, personId)).map(m => m.id)).toEqual([winter.id, summerRow.id]);
    });

    it('forPeople returns the memberships of several people in one call', async () => {
      const a = await newPerson();
      const b = await newPerson();
      const c = await newPerson();
      await fx.repos.memberships.add(fx.actor, summer(a));
      await fx.repos.memberships.add(fx.actor, summer(b));
      await fx.repos.memberships.add(fx.actor, summer(c));
      const found = await fx.repos.memberships.forPeople(fx.actor.orgId, [a, b]);
      expect(found.map(m => m.personId).sort()).toEqual([a, b].sort());
      expect(await fx.repos.memberships.forPeople(fx.actor.orgId, [])).toEqual([]);
    });

    it('revoke sets the time and reason; a second revoke keeps the first reason and time', async () => {
      const membership = await fx.repos.memberships.add(fx.actor, summer(await newPerson()));
      const revoked = await fx.repos.memberships.revoke(fx.actor, membership.id, 'Unpaid', '2027-06-10T08:00:00.000Z');
      expect(revoked.revokedAt).toMatch(ISO_INSTANT);
      expect(revoked).toMatchObject({ revokedAt: '2027-06-10T08:00:00.000Z', revokedReason: 'Unpaid' });
      const again = await fx.repos.memberships.revoke(fx.actor, membership.id, 'Other reason', '2027-07-01T08:00:00.000Z');
      expect(again).toEqual(revoked);
    });

    it('revoke throws MembershipNotFoundError for an unknown id or another organisation\'s membership', async () => {
      await expectRejection(fx.repos.memberships.revoke(fx.actor, randomUUID(), 'x', '2027-06-10T08:00:00.000Z'), isMembershipNotFound);
      const membership = await fx.repos.memberships.add(fx.actor, summer(await newPerson()));
      await expectRejection(fx.repos.memberships.revoke(fx.otherActor, membership.id, 'x', '2027-06-10T08:00:00.000Z'), isMembershipNotFound);
    });

    it('audits membership.create and, once, membership.revoke', async () => {
      const membership = await fx.repos.memberships.add(fx.actor, summer(await newPerson()));
      await fx.repos.memberships.revoke(fx.actor, membership.id, 'Unpaid', '2027-06-10T08:00:00.000Z');
      await fx.repos.memberships.revoke(fx.actor, membership.id, 'Again', '2027-06-11T08:00:00.000Z');
      expect((await fx.auditActions()).filter(a => a.startsWith('membership.'))).toEqual(['membership.create', 'membership.revoke']);
    });

    it('another organisation cannot read memberships', async () => {
      const personId = await newPerson();
      await fx.repos.memberships.add(fx.actor, summer(personId));
      expect(await fx.repos.memberships.forPerson(fx.otherActor.orgId, personId)).toEqual([]);
      expect(await fx.repos.memberships.forPeople(fx.otherActor.orgId, [personId])).toEqual([]);
    });
  });
}
