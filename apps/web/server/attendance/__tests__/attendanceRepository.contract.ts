import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAlreadyCheckedIn, isNotOnSite } from '../AttendanceRepository';
import { isPersonNotFound } from '../../people/PeopleRepository';
import { expectRejection, ISO_INSTANT, samplePerson, type RepositoryFactory, type RepositoryFixture } from '../../people/__tests__/fixture';

const MORNING = '2027-07-01T09:12:00.000Z';
const NOON = '2027-07-01T12:00:00.000Z';
const NEXT_DAY = '2027-07-02T09:00:00.000Z';

/** One contract for every AttendanceRepository adapter: one open visit per person, check-out rules, and the log. */
export function attendanceRepositoryContract(factory: RepositoryFactory): void {
  describe('AttendanceRepository contract', () => {
    let fx: RepositoryFixture;
    beforeEach(async () => { fx = await factory(); });
    afterEach(async () => { await fx.close(); });

    const newPerson = async (): Promise<string> => (await fx.repos.people.create(fx.actor, samplePerson())).id;
    const arrive = (personId: string, at = MORNING, overrideReason: string | null = null) =>
      fx.repos.attendance.checkIn(fx.actor, { personId, at, method: 'qr', overrideReason, note: null });
    const leave = (personId: string, at = NOON, collectedByPersonId: string | null = null, overrideReason: string | null = null) =>
      fx.repos.attendance.checkOut(fx.actor, { personId, at, collectedByPersonId, overrideReason, note: null });

    it('checks a person in: the visit is open, with ISO instants and the actor', async () => {
      const personId = await newPerson();
      const visit = await arrive(personId);
      expect(visit).toEqual({
        id: visit.id,
        personId,
        checkedInAt: MORNING,
        checkedInBy: fx.actor.userId,
        method: 'qr',
        checkedOutAt: null,
        checkedOutBy: null,
        collectedByPersonId: null,
        overrideReason: null,
        note: null,
      });
      expect(visit.checkedInAt).toMatch(ISO_INSTANT);
      expect(await fx.repos.attendance.openFor(fx.actor.orgId, personId)).toEqual(visit);
    });

    it('refuses a second open visit for the same person, and keeps the first one', async () => {
      const personId = await newPerson();
      const first = await arrive(personId);
      await expectRejection(arrive(personId, NOON), isAlreadyCheckedIn);
      expect(await fx.repos.attendance.openFor(fx.actor.orgId, personId)).toEqual(first);
      expect(await fx.repos.attendance.onSite(fx.actor.orgId)).toHaveLength(1);
    });

    it('throws PersonNotFoundError for an unknown person or another organisation\'s person', async () => {
      await expectRejection(arrive(randomUUID()), isPersonNotFound);
      const theirs = (await fx.repos.people.create(fx.otherActor, samplePerson())).id;
      await expectRejection(arrive(theirs), isPersonNotFound);
    });

    it('checks out: the visit closes with the time, the actor and who collected the person', async () => {
      const child = await newPerson();
      const guardian = await newPerson();
      await arrive(child);
      const closed = await leave(child, NOON, guardian);
      expect(closed).toMatchObject({ checkedOutAt: NOON, checkedOutBy: fx.actor.userId, collectedByPersonId: guardian });
      expect(closed.checkedOutAt).toMatch(ISO_INSTANT);
      expect(await fx.repos.attendance.openFor(fx.actor.orgId, child)).toBeNull();
      expect(await fx.repos.attendance.onSite(fx.actor.orgId)).toEqual([]);
    });

    it('a person can be checked in again after checking out', async () => {
      const personId = await newPerson();
      await arrive(personId);
      await leave(personId);
      const again = await arrive(personId, NEXT_DAY);
      expect(again.checkedOutAt).toBeNull();
      expect(await fx.repos.attendance.onSite(fx.actor.orgId)).toEqual([again]);
    });

    it('check-out of someone not on site is refused', async () => {
      const personId = await newPerson();
      await expectRejection(leave(personId), isNotOnSite);
      await arrive(personId);
      await leave(personId);
      await expectRejection(leave(personId, NEXT_DAY), isNotOnSite);
    });

    it('check-out refuses an unknown collector and leaves the visit open', async () => {
      const personId = await newPerson();
      await arrive(personId);
      await expectRejection(leave(personId, NOON, randomUUID()), isPersonNotFound);
      expect((await fx.repos.attendance.openFor(fx.actor.orgId, personId))?.checkedOutAt).toBeNull();
    });

    it('onSite lists everyone on site, oldest arrival first', async () => {
      const late = await newPerson();
      const early = await newPerson();
      const gone = await newPerson();
      await arrive(late, NOON);
      await arrive(early, MORNING);
      await arrive(gone, MORNING);
      await leave(gone, NOON);
      expect((await fx.repos.attendance.onSite(fx.actor.orgId)).map(v => v.personId)).toEqual([early, late]);
    });

    it('a check-in override reason is recorded and audited', async () => {
      const personId = await newPerson();
      const visit = await arrive(personId, MORNING, 'Parent confirmed by phone');
      expect(visit.overrideReason).toBe('Parent confirmed by phone');
      expect((await fx.auditActions()).filter(a => a.startsWith('attendance.'))).toEqual(['attendance.check_in', 'attendance.override']);
    });

    it('audits check_in and check_out, and a check-out override reason separately', async () => {
      const personId = await newPerson();
      await arrive(personId);
      await leave(personId, NOON, null, 'Left early with consent');
      expect((await fx.auditActions()).filter(a => a.startsWith('attendance.'))).toEqual(['attendance.check_in', 'attendance.check_out', 'attendance.override']);
    });

    it('log returns visits in [from, to), newest first, optionally for one person or on site only', async () => {
      const a = await newPerson();
      const b = await newPerson();
      await arrive(a, MORNING);
      await leave(a, NOON);
      await arrive(b, NEXT_DAY);
      const day1 = { from: '2027-07-01T00:00:00.000Z', to: '2027-07-02T00:00:00.000Z' };
      expect((await fx.repos.attendance.log(fx.actor.orgId, day1)).map(v => v.personId)).toEqual([a]);
      const all = { from: '2027-07-01T00:00:00.000Z', to: '2027-07-03T00:00:00.000Z' };
      expect((await fx.repos.attendance.log(fx.actor.orgId, all)).map(v => v.personId)).toEqual([b, a]);
      expect(await fx.repos.attendance.log(fx.actor.orgId, { ...all, personId: a })).toHaveLength(1);
      expect((await fx.repos.attendance.log(fx.actor.orgId, { ...all, onSiteOnly: true })).map(v => v.personId)).toEqual([b]);
      expect(await fx.repos.attendance.log(fx.actor.orgId, { ...all, personId: 'not-a-uuid' })).toEqual([]);
    });

    it('another organisation sees no visits and cannot check anyone out', async () => {
      const personId = await newPerson();
      await arrive(personId);
      expect(await fx.repos.attendance.openFor(fx.otherActor.orgId, personId)).toBeNull();
      expect(await fx.repos.attendance.onSite(fx.otherActor.orgId)).toEqual([]);
      expect(await fx.repos.attendance.log(fx.otherActor.orgId, { from: '2027-01-01T00:00:00.000Z', to: '2028-01-01T00:00:00.000Z' })).toEqual([]);
      await expectRejection(fx.repos.attendance.checkOut(fx.otherActor, { personId, at: NOON, collectedByPersonId: null, overrideReason: null, note: null }), isNotOnSite);
    });
  });
}
