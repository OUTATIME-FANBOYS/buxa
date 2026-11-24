import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decideEnrolment, type Actor } from '@buxa/domain';
import type { ClassRecord, ClassRepository, EnrolmentRule } from '../ClassRepository';
import { CapacityBelowEnrolledError, SessionFullError } from '../errors';

/** What a class contract test runs against: a repository, an owner of the camp under test, and ways to add people and holds. */
export interface ClassContractFixture {
  readonly repo: ClassRepository;
  /** An owner of the camp under test. */
  readonly actor: Actor;
  /** A camper of the camp under test, aged 11 on the class day. A family name puts the camper in that household. */
  addCamper(familyName?: string): Promise<string>;
  /**
   * A seat hold on a class. Live when `released` is false and `expiresAt` is in the future. The household it is for is named
   * `householdName` (a test family when not given).
   */
  addSeatHold(classId: string, hold: { expiresAt: string; released: boolean; householdName?: string }): Promise<void>;
  close(): Promise<void>;
}

export type ClassContractFactory = () => Promise<ClassContractFixture>;

const CLASS_DAY = '2027-07-05';
const LIVE_HOLD_EXPIRY = '2999-01-01T00:00:00.000Z';
const EXPIRED_HOLD_EXPIRY = '2000-01-01T00:00:00.000Z';
/** How long a short hold lives in the test that waits for it to expire. Long enough to enrol first, short enough to keep the test quick. */
const SHORT_HOLD_MS = 1000;

const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const SESSION = {
  name: 'Summer camp',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-31',
};

const ROBOTICS: Omit<ClassRecord, 'capacity'> = {
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  location: 'Lab 1',
  startsAt: `${CLASS_DAY}T09:00:00+10:00`,
  endsAt: `${CLASS_DAY}T12:00:00+10:00`,
  instructorIds: [],
  price: null,
};

/** The domain's enrolment rule, with no override and no waitlist unless asked for. */
function rule(waitlistIfFull: boolean): EnrolmentRule {
  return facts =>
    decideEnrolment({ ...facts, sessionDay: CLASS_DAY }, { waitlistIfFull, override: null, actorCanOverride: false });
}

/**
 * One contract for every ClassRepository adapter: the seats of a class (enrolled, waitlisted, held), the waitlist order, and the
 * camp size floor.
 */
export function classRepositoryContract(factory: ClassContractFactory): void {
  describe('ClassRepository contract', () => {
    let fx: ClassContractFixture;
    beforeEach(async () => {
      fx = await factory();
    });
    afterEach(async () => {
      await fx.close();
    });

    let sessionNumber = 0;

    /** A session with one class of the given camp size. Returns the class id, which is what enrolments and holds name. */
    const classOf = async (capacity: number): Promise<string> => {
      // Each session gets its own name: session names are unique per camp (migration 0052), and the tests share one camp.
      sessionNumber += 1;
      const session = await fx.repo.createSession(fx.actor, { ...SESSION, name: `${SESSION.name} ${sessionNumber}` });
      const cls = await fx.repo.addClass(fx.actor, session.id, { ...ROBOTICS, capacity });

      return cls.id;
    };
    const countsOf = async (classId: string) => {
      const cls = await fx.repo.getClass(fx.actor.userId, fx.actor.orgId, classId);

      return { seatsTaken: cls?.seatsTaken, waitlisted: cls?.waitlisted };
    };
    const enrol = (classId: string, camperId: string, waitlistIfFull = false) =>
      fx.repo.enrol(fx.actor, { classId, camperId }, rule(waitlistIfFull));

    it('enrols campers up to the camp size, and counts the places taken', async () => {
      const classId = await classOf(2);
      const ada = await enrol(classId, await fx.addCamper());
      const ben = await enrol(classId, await fx.addCamper());
      expect([ada.status, ben.status]).toEqual(['enrolled', 'enrolled']);
      expect(await countsOf(classId)).toEqual({ seatsTaken: 2, waitlisted: 0 });
    });

    it('refuses the camper after the last place when no waitlist is asked for', async () => {
      const classId = await classOf(1);
      await enrol(classId, await fx.addCamper());
      await expect(enrol(classId, await fx.addCamper())).rejects.toBeInstanceOf(SessionFullError);
      expect(await countsOf(classId)).toEqual({ seatsTaken: 1, waitlisted: 0 });
    });

    it('the next camper waitlists when asked, and takes no place', async () => {
      const classId = await classOf(1);
      await enrol(classId, await fx.addCamper());
      const waiting = await enrol(classId, await fx.addCamper(), true);
      expect(waiting.status).toBe('waitlisted');
      expect(await countsOf(classId)).toEqual({ seatsTaken: 1, waitlisted: 1 });
    });

    it('cancelling promotes the first waitlisted camper, in the order they joined', async () => {
      const classId = await classOf(1);
      const placed = await enrol(classId, await fx.addCamper());
      const first = await enrol(classId, await fx.addCamper(), true);
      const second = await enrol(classId, await fx.addCamper(), true);

      await fx.repo.cancelEnrolment(fx.actor, placed.id, null);

      const statuses = (await fx.repo.listEnrolments(fx.actor.userId, fx.actor.orgId, classId)).map(e => [
        e.id,
        e.status,
      ]);
      expect(statuses).toEqual([
        [placed.id, 'cancelled'],
        [first.id, 'enrolled'],
        [second.id, 'waitlisted'],
      ]);
      expect(await countsOf(classId)).toEqual({ seatsTaken: 1, waitlisted: 1 });
    });

    it('lowering the camp size below the places taken is refused, and the class keeps its size', async () => {
      const classId = await classOf(3);
      await enrol(classId, await fx.addCamper());
      await enrol(classId, await fx.addCamper());
      await expect(fx.repo.updateClass(fx.actor, classId, { ...ROBOTICS, capacity: 1 })).rejects.toBeInstanceOf(
        CapacityBelowEnrolledError,
      );
      const cls = await fx.repo.getClass(fx.actor.userId, fx.actor.orgId, classId);
      expect(cls?.capacity).toBe(3);
    });

    it('lowering the camp size to exactly the places taken is allowed', async () => {
      const classId = await classOf(3);
      await enrol(classId, await fx.addCamper());
      await enrol(classId, await fx.addCamper());
      const updated = await fx.repo.updateClass(fx.actor, classId, { ...ROBOTICS, capacity: 2 });
      expect(updated.capacity).toBe(2);
    });

    it('a live seat hold counts as a place taken', async () => {
      const classId = await classOf(1);
      await fx.addSeatHold(classId, { expiresAt: LIVE_HOLD_EXPIRY, released: false });
      expect(await countsOf(classId)).toEqual({ seatsTaken: 1, waitlisted: 0 });
      await expect(enrol(classId, await fx.addCamper())).rejects.toBeInstanceOf(SessionFullError);
    });

    it('an expired seat hold does not count', async () => {
      const classId = await classOf(1);
      await fx.addSeatHold(classId, { expiresAt: EXPIRED_HOLD_EXPIRY, released: false });
      expect(await countsOf(classId)).toEqual({ seatsTaken: 0, waitlisted: 0 });
      expect((await enrol(classId, await fx.addCamper())).status).toBe('enrolled');
    });

    it('a waitlisted camper takes a place freed by an expired hold when another camper enrols', async () => {
      const classId = await classOf(2);
      await enrol(classId, await fx.addCamper());
      await fx.addSeatHold(classId, { expiresAt: new Date(Date.now() + SHORT_HOLD_MS).toISOString(), released: false });
      const waiting = await enrol(classId, await fx.addCamper(), true);
      expect(waiting.status).toBe('waitlisted');

      await pause(SHORT_HOLD_MS + 100);
      const next = await enrol(classId, await fx.addCamper(), true);

      const statusOf = async (id: string) =>
        (await fx.repo.listEnrolments(fx.actor.userId, fx.actor.orgId, classId)).find(e => e.id === id)?.status;
      expect(await statusOf(waiting.id)).toBe('enrolled');
      expect(await statusOf(next.id)).toBe('waitlisted');
      expect(await countsOf(classId)).toEqual({ seatsTaken: 2, waitlisted: 1 });
    });

    it('a refused enrolment does not promote the waitlist or release the expired hold', async () => {
      const classId = await classOf(2);
      await enrol(classId, await fx.addCamper());
      await fx.addSeatHold(classId, { expiresAt: new Date(Date.now() + SHORT_HOLD_MS).toISOString(), released: false });
      const waiting = await enrol(classId, await fx.addCamper(), true);

      await pause(SHORT_HOLD_MS + 100);
      await expect(enrol(classId, await fx.addCamper())).rejects.toBeInstanceOf(SessionFullError);

      const statusOf = async (id: string) =>
        (await fx.repo.listEnrolments(fx.actor.userId, fx.actor.orgId, classId)).find(e => e.id === id)?.status;
      expect(await statusOf(waiting.id)).toBe('waitlisted');
      expect(await countsOf(classId)).toEqual({ seatsTaken: 1, waitlisted: 1 });
    });

    it('lists the live seat holds of every class in the camp, soonest expiry first, and hides expired and released ones', async () => {
      const first = await classOf(4);
      const second = await classOf(4);
      await fx.addSeatHold(first, {
        expiresAt: '2999-01-02T00:00:00.000Z',
        released: false,
        householdName: 'Okafor family',
      });
      await fx.addSeatHold(second, {
        expiresAt: '2999-01-01T00:00:00.000Z',
        released: false,
        householdName: 'Lee family',
      });
      await fx.addSeatHold(first, { expiresAt: EXPIRED_HOLD_EXPIRY, released: false, householdName: 'Expired family' });
      await fx.addSeatHold(second, { expiresAt: LIVE_HOLD_EXPIRY, released: true, householdName: 'Released family' });

      const holds = await fx.repo.listCampActiveHolds(fx.actor.userId, fx.actor.orgId);

      expect(holds.map(h => h.householdName)).toEqual(['Lee family', 'Okafor family']);
      expect(holds[0]).toMatchObject({ classId: second, className: 'Robotics' });
      expect(holds[0]?.sessionName).toMatch(/^Summer camp \d+$/);
      expect(holds[1]).toMatchObject({ classId: first, expiresAt: '2999-01-02T00:00:00.000Z' });
    });

    it('lists the waitlist of each class in the order the campers joined, with each family name', async () => {
      const classId = await classOf(1);
      await enrol(classId, await fx.addCamper('Ruiz family'));
      await enrol(classId, await fx.addCamper('Ito family'), true);
      await enrol(classId, await fx.addCamper('Mensah family'), true);

      const waitlist = (await fx.repo.listCampWaitlists(fx.actor.userId, fx.actor.orgId)).filter(
        entry => entry.classId === classId,
      );

      expect(waitlist.map(entry => entry.householdName)).toEqual(['Ito family', 'Mensah family']);
      expect(waitlist[0]).toMatchObject({ className: 'Robotics' });
      expect(waitlist[0]?.sessionName).toMatch(/^Summer camp \d+$/);
      expect(waitlist[0]?.camperName).not.toBe('');
    });

    it('a released seat hold does not count, even before its time', async () => {
      const classId = await classOf(1);
      await fx.addSeatHold(classId, { expiresAt: LIVE_HOLD_EXPIRY, released: true });
      expect(await countsOf(classId)).toEqual({ seatsTaken: 0, waitlisted: 0 });
    });
  });
}
