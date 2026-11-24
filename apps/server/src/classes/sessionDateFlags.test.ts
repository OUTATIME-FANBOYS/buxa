import { describe, expect, it } from 'vitest';
import type { ClassInput } from '@buxa/contracts';
import { CAMPER_ADA, JULY_SESSION, as, robotics, setup } from './__tests__/fixtures';

/*
 * Session date edits flag the classes that fall outside the new dates (migration 0059). These tests run against the in-memory
 * repository; the Postgres file (sessionDateFlags.pg.test.ts) runs the same rules on the database.
 */

const SHRUNK = { ...JULY_SESSION, name: 'Summer camp', startsOn: '2027-07-01', endsOn: '2027-07-10' };

/** A class on one day of July 2027 in Sydney, 09:00 to 12:00. */
const onJuly = (day: number): Pick<ClassInput, 'startsAt' | 'endsAt'> => ({
  startsAt: `2027-07-${String(day).padStart(2, '0')}T09:00:00+10:00`,
  endsAt: `2027-07-${String(day).padStart(2, '0')}T12:00:00+10:00`,
});

const expectOk = <T>(outcome: { ok: true; value: T } | { ok: false; failure: { message: string } }): T => {
  if (!outcome.ok) {
    throw new Error(outcome.failure.message);
  }

  return outcome.value;
};

/** A live session (July 2027) with a class on July 5, one on July 20 and one on July 25. Returns their ids. */
async function setupLive() {
  const ctx = setup();
  const session = expectOk(await ctx.service.createSession(as('admin'), JULY_SESSION));
  expectOk(await ctx.service.publishSession(as('admin'), session.id));
  const early = expectOk(
    await ctx.service.addClass(as('admin'), session.id, { ...robotics, ...onJuly(5), name: 'Early' }),
  );
  const late = expectOk(
    await ctx.service.addClass(as('admin'), session.id, { ...robotics, ...onJuly(20), name: 'Swim Stars' }),
  );
  const last = expectOk(
    await ctx.service.addClass(as('admin'), session.id, { ...robotics, ...onJuly(25), name: 'Art' }),
  );

  return { ...ctx, sessionId: session.id, early: early.id, late: late.id, last: last.id };
}

describe('a shrink flags the classes outside the new dates', () => {
  it('flags exactly the classes outside the new dates, keeps their times, and leaves the others alone', async () => {
    const { service, sessionId, late, last, early } = await setupLive();

    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    const classes = expectOk(await service.listClasses(as('admin'), sessionId));
    const byId = new Map(classes.map(c => [c.id, c]));
    expect(byId.get(early)?.datesOutsideSession).toBe(false);
    expect(byId.get(late)).toMatchObject({ datesOutsideSession: true, startsAt: onJuly(20).startsAt });
    expect(byId.get(last)).toMatchObject({ datesOutsideSession: true, endsAt: onJuly(25).endsAt });
  });

  it('writes one class.dates_flagged audit entry for each newly flagged class', async () => {
    const { service, sessionId, repo, late, last } = await setupLive();

    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    const flagged = repo.audit.filter(a => a.action === 'class.dates_flagged').map(a => a.entityId);
    expect(flagged.sort()).toEqual([late, last].sort());
  });

  it('a widening flags nothing and writes no flag audit', async () => {
    const { service, sessionId, repo } = await setupLive();

    expectOk(
      await service.updateSession(as('admin'), sessionId, {
        ...SHRUNK,
        startsOn: '2027-06-01',
        endsOn: '2027-08-31',
      }),
    );

    const classes = expectOk(await service.listClasses(as('admin'), sessionId));
    expect(classes.some(c => c.datesOutsideSession)).toBe(false);
    expect(repo.audit.some(a => a.action === 'class.dates_flagged')).toBe(false);
  });

  it('widening the dates again over a flagged class clears its flag', async () => {
    const { service, sessionId, late } = await setupLive();
    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    expectOk(await service.updateSession(as('admin'), sessionId, { ...SHRUNK, endsOn: '2027-07-31' }));

    const classes = expectOk(await service.listClasses(as('admin'), sessionId));
    expect(classes.find(c => c.id === late)?.datesOutsideSession).toBe(false);
  });
});

describe('a shrink with people on an affected class is refused, and nothing changes', () => {
  it('refuses when an affected class has an enrolment, names it, and saves nothing', async () => {
    const { service, repo, sessionId, late } = await setupLive();
    expectOk(await service.enrol(as('admin'), { classId: late, camperId: CAMPER_ADA, waitlistIfFull: false }));
    const auditBefore = repo.audit.length;

    const outcome = await service.updateSession(as('admin'), sessionId, SHRUNK);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_dates_blocked');
      expect(outcome.failure.message).toBe(
        'Swim Stars would fall outside the new dates, and it has people on it. Move or cancel it first, then change the session dates.',
      );
    }
    const session = expectOk(await service.getSession(as('admin'), sessionId));
    expect(session).toMatchObject({ startsOn: JULY_SESSION.startsOn, endsOn: JULY_SESSION.endsOn });
    const classes = expectOk(await service.listClasses(as('admin'), sessionId));
    expect(classes.some(c => c.datesOutsideSession)).toBe(false);
    expect(repo.audit.length).toBe(auditBefore);
  });

  it('refuses when an affected class has a seat hold', async () => {
    const { service, repo, sessionId, last } = await setupLive();
    repo.seedSeatHold(last, { expiresAt: '2999-01-01T00:00:00.000Z', released: false });

    const outcome = await service.updateSession(as('admin'), sessionId, SHRUNK);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_dates_blocked');
    }
  });
});

describe('a flagged class takes no places', () => {
  it('refuses an enrolment into a flagged class, with the owner-approved message', async () => {
    const { service, sessionId, late } = await setupLive();
    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    const outcome = await service.enrol(as('admin'), { classId: late, camperId: CAMPER_ADA, waitlistIfFull: false });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('class_dates_flagged');
      expect(outcome.failure.message).toBe("This class falls outside its session's dates. Fix its dates first.");
    }
  });

  it('an enrolment into a class that is not flagged still works', async () => {
    const { service, sessionId, early } = await setupLive();
    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    const outcome = await service.enrol(as('admin'), { classId: early, camperId: CAMPER_ADA, waitlistIfFull: false });

    expect(outcome.ok).toBe(true);
  });
});

describe('a session with a flagged class cannot go live', () => {
  it('refuses publish while any class is flagged, and naming the class', async () => {
    const ctx = setup();
    const session = expectOk(await ctx.service.createSession(as('admin'), JULY_SESSION));
    expectOk(await ctx.service.addClass(as('admin'), session.id, { ...robotics, ...onJuly(20), name: 'Swim Stars' }));
    expectOk(await ctx.service.updateSession(as('admin'), session.id, SHRUNK));

    const outcome = await ctx.service.publishSession(as('admin'), session.id);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('session_publish_blocked');
      expect(outcome.failure.message).toBe(
        'This session cannot go live: Swim Stars has dates outside the session. Fix its dates first.',
      );
    }
    const after = expectOk(await ctx.service.getSession(as('admin'), session.id));
    expect(after.status).toBe('draft');
  });
});

describe('fixing a flagged class', () => {
  it('a class saved with dates inside the session clears its flag and can take places again', async () => {
    const { service, sessionId, late } = await setupLive();
    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    expectOk(
      await service.updateClass(as('admin'), late, {
        ...robotics,
        ...onJuly(8),
        name: 'Swim Stars',
        instructorIds: [],
      }),
    );

    const fixed = expectOk(await service.getClass(as('admin'), late));
    expect(fixed.datesOutsideSession).toBe(false);
    expect((await service.enrol(as('admin'), { classId: late, camperId: CAMPER_ADA, waitlistIfFull: false })).ok).toBe(
      true,
    );
  });

  it('a class edit that moves a class outside the session is refused, with the owner-approved message', async () => {
    const { service, sessionId, early } = await setupLive();
    expectOk(await service.updateSession(as('admin'), sessionId, SHRUNK));

    const outcome = await service.updateClass(as('admin'), early, {
      ...robotics,
      ...onJuly(22),
      name: 'Early',
      instructorIds: [],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.reason).toBe('class_outside_session');
      expect(outcome.failure.message).toBe(
        'The class falls outside the session dates. Change the session dates first.',
      );
    }
  });
});
