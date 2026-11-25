import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { PgPublicSessionRepository } from '../publicSessions/PgPublicSessionRepository';
import { ClassDatesFlaggedError, SessionDatesBlockedError, SessionPublishBlockedError } from './errors';
import {
  createClassFixture,
  enrolRule,
  makeSession,
  sessionInput,
  type ClassFixture,
} from './__tests__/pgClassFixture';

/*
 * The session date flag on Postgres (migration 0059): a shrink flags the classes outside the new dates in the same transaction as the
 * save, a flagged class does not widen its session, takes no enrolment, is not listed publicly, and blocks a publish. Runs only with
 * DATABASE_URL, on a migrated database.
 */

const url = process.env.DATABASE_URL;

/** A class on one day of July 2027 in Sydney, 09:00 to 12:00. */
const onJuly = (day: number, name: string) => ({
  ...sessionInput(9, 12, { name }),
  startsAt: `2027-07-${String(day).padStart(2, '0')}T09:00:00+10:00`,
  endsAt: `2027-07-${String(day).padStart(2, '0')}T12:00:00+10:00`,
});

describe.skipIf(!url)('session date flag on Postgres (migration 0059)', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  beforeEach(async () => {
    fx = await createClassFixture(pool);
  });
  afterEach(async () => {
    await fx.close();
  });

  const shrunk = (name: string) => ({
    name,
    description: 'Shrunk.',
    startsOn: '2027-07-01',
    endsOn: '2027-07-10',
    isPublic: true,
  });

  /** Reads the class row's flag and times through the adapter's own read. */
  async function classState(classId: string) {
    const cls = await fx.repo.getClass(fx.actor.userId, fx.orgA, classId);

    return cls && { datesOutsideSession: cls.datesOutsideSession, startsAt: cls.startsAt, endsAt: cls.endsAt };
  }

  it('a shrink flags exactly the classes outside the new dates, keeps their times, and audits each one', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const early = await fx.repo.addClass(fx.actor, session.id, onJuly(5, 'Early'));
    const late = await fx.repo.addClass(fx.actor, session.id, onJuly(20, 'Swim Stars'));
    const lateTimes = { startsAt: late.startsAt, endsAt: late.endsAt };

    await fx.repo.updateSession(fx.actor, session.id, shrunk(session.name));

    expect(await classState(early.id)).toMatchObject({ datesOutsideSession: false });
    expect(await classState(late.id)).toEqual({ datesOutsideSession: true, ...lateTimes });
    const flagged = await withOrg(pool, fx.actor.userId, fx.orgA, db =>
      db.query<{ entity_id: string }>(
        `SELECT entity_id FROM audit_log WHERE action = 'class.dates_flagged' AND org_id = $1`,
        [fx.orgA],
      ),
    );
    expect(flagged.rows.map(r => r.entity_id)).toEqual([late.id]);
  });

  it('a shrink with an enrolment on a class it would flag is refused, and nothing is saved or flagged', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const late = await fx.repo.addClass(fx.actor, session.id, onJuly(20, 'Swim Stars'));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');
    await fx.repo.enrol(fx.actor, { classId: late.id, camperId: camper }, enrolRule());

    await expect(fx.repo.updateSession(fx.actor, session.id, shrunk(session.name))).rejects.toBeInstanceOf(
      SessionDatesBlockedError,
    );

    const parent = await fx.repo.getSession(fx.actor.userId, fx.orgA, session.id);
    expect(parent).toMatchObject({ startsOn: '2027-07-01', endsOn: '2027-07-31' });
    expect(await classState(late.id)).toMatchObject({ datesOutsideSession: false });
  });

  it('a flagged class does not widen its session when it is written again', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const late = await fx.repo.addClass(fx.actor, session.id, onJuly(20, 'Swim Stars'));
    await fx.repo.updateSession(fx.actor, session.id, shrunk(session.name));

    // A write to the flagged class's times fires the widen trigger (0022). With the flag set, it must leave the session alone.
    await withOrg(pool, fx.actor.userId, fx.orgA, db =>
      db.query(`UPDATE sessions SET ends_at = '2027-07-20T12:00:00+10:00' WHERE id = $1`, [late.id]),
    );

    const parent = await fx.repo.getSession(fx.actor.userId, fx.orgA, session.id);
    expect(parent).toMatchObject({ endsOn: '2027-07-10' });
  });

  it('a flagged class takes no enrolment, with the owner-approved message', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const late = await fx.repo.addClass(fx.actor, session.id, onJuly(20, 'Swim Stars'));
    await fx.repo.updateSession(fx.actor, session.id, shrunk(session.name));
    const camper = await fx.addPerson(fx.orgA, '2016-03-01');

    const attempt = fx.repo.enrol(fx.actor, { classId: late.id, camperId: camper }, enrolRule());

    await expect(attempt).rejects.toBeInstanceOf(ClassDatesFlaggedError);
    await expect(attempt).rejects.toMatchObject({
      message: "This class falls outside its session's dates. Fix its dates first.",
    });
  });

  it('a flagged class is not listed on the public page, and the class is listed again once its dates are fixed', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const late = await fx.repo.addClass(fx.actor, session.id, onJuly(20, 'Swim Stars'));
    const slugRows = await pool.query<{ slug: string }>('SELECT slug FROM orgs WHERE id = $1', [fx.orgA]);
    const slug = slugRows.rows[0].slug;
    const publicRepo = new PgPublicSessionRepository(pool);
    const from = new Date('2027-07-01T00:00:00Z');
    await fx.repo.updateSession(fx.actor, session.id, shrunk(session.name));
    expect(await publicRepo.listUpcomingClasses(slug, session.id, from)).toEqual([]);

    await fx.repo.updateClass(fx.actor, late.id, { ...onJuly(8, 'Swim Stars'), capacity: 5, price: null });

    expect(await publicRepo.listUpcomingClasses(slug, session.id, from)).toHaveLength(1);
  });

  it('a session with a flagged class cannot go live, and can once the class is fixed', async () => {
    const draft = await fx.repo.createSession(fx.actor, {
      name: `Draft ${Date.now()}`,
      description: '',
      startsOn: '2027-07-01',
      endsOn: '2027-07-31',
    });
    const late = await fx.repo.addClass(fx.actor, draft.id, onJuly(20, 'Swim Stars'));
    await fx.repo.updateSession(fx.actor, draft.id, shrunk(draft.name));

    await expect(fx.repo.publishSession(fx.actor, draft.id)).rejects.toBeInstanceOf(SessionPublishBlockedError);
    expect((await fx.repo.getSession(fx.actor.userId, fx.orgA, draft.id))?.status).toBe('draft');

    await fx.repo.updateClass(fx.actor, late.id, { ...onJuly(8, 'Swim Stars'), capacity: 5, price: null });
    const live = await fx.repo.publishSession(fx.actor, draft.id);
    expect(live.status).toBe('live');
  });
});
