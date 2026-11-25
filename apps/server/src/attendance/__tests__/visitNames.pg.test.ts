import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgAttendanceRepository } from '../PgAttendanceRepository';
import type { CheckInRecord } from '../AttendanceRepository';
import {
  createClassFixture,
  makeSession,
  sessionInput,
  type ClassFixture,
} from '../../classes/__tests__/pgClassFixture';

const url = process.env.DATABASE_URL;
const MORNING = '2027-07-05T08:00:00.000Z';
const WINDOW = { from: '2027-07-01T00:00:00.000Z', to: '2027-08-01T00:00:00.000Z' };

/**
 * A visit names its session (the check_ins.session_id row of classes) and the class: the series the camper is actively enrolled
 * in for that session. These are joins in the visit query, so they are read back through the log and the open-visit read.
 */
describe.skipIf(!url)('visit session and class names on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 3, application_name: 'buxa-visit-names' });
  let fx: ClassFixture;
  let repo: PgAttendanceRepository;

  beforeAll(async () => {
    await migrate(pool);
    repo = new PgAttendanceRepository(pool);
  }, 120_000);
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    fx = await createClassFixture(pool);
  });
  afterEach(async () => {
    await fx.close();
  });

  const logged = async (personId: string): Promise<CheckInRecord> => {
    const visits = await repo.log(fx.actor.userId, fx.actor.orgId, WINDOW);
    const found = visits.find(v => v.personId === personId);
    if (!found) {
      throw new Error('the visit is not in the log');
    }

    return found;
  };

  it('names the session, and the class the camper is enrolled in for it', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const occurrence = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { name: 'Robotics' }));
    const person = await fx.addPerson(fx.orgA, '2015-03-01', 'Ada');
    const series = await pool.query<{ series_id: string; name: string }>(
      `SELECT s.series_id, ser.name FROM sessions s JOIN class_series ser ON ser.id = s.series_id WHERE s.id = $1`,
      [occurrence.id],
    );
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
      fx.orgA,
      occurrence.id,
      person,
    ]);

    await repo.checkIn(fx.actor, {
      personId: person,
      at: MORNING,
      method: 'qr',
      overrideReason: null,
      note: null,
      sessionId: session.id,
      sessionUnassigned: false,
    });

    const visit = await logged(person);
    expect(visit).toMatchObject({
      sessionId: session.id,
      sessionName: session.name,
      classId: series.rows[0]?.series_id,
      className: series.rows[0]?.name,
    });
  });

  it('names the session but no class when the camper is not enrolled in one', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
    const person = await fx.addPerson(fx.orgA, '2015-03-01', 'Ben');

    await repo.checkIn(fx.actor, {
      personId: person,
      at: MORNING,
      method: 'search',
      overrideReason: null,
      note: null,
      sessionId: session.id,
      sessionUnassigned: true,
    });

    expect(await logged(person)).toMatchObject({ sessionName: session.name, classId: null, className: null });
  });

  it('filters the log by session, class, method, staff and status, and the filters combine', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const occurrence = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12, { name: 'Art' }));
    const kim = await fx.addPerson(fx.orgA, '2015-03-01', 'Kim');
    const ben = await fx.addPerson(fx.orgA, '1990-04-02', 'Ben');
    const series = await pool.query<{ id: string; name: string }>(
      `SELECT ser.id, ser.name FROM sessions s JOIN class_series ser ON ser.id = s.series_id WHERE s.id = $1`,
      [occurrence.id],
    );
    const seriesId = series.rows[0]?.id ?? '';
    await pool.query(`INSERT INTO enrolments (org_id, session_id, person_id, status) VALUES ($1, $2, $3, 'enrolled')`, [
      fx.orgA,
      occurrence.id,
      kim,
    ]);
    await repo.checkIn(fx.actor, {
      personId: kim,
      at: MORNING,
      method: 'qr',
      overrideReason: null,
      note: null,
      sessionId: session.id,
      sessionUnassigned: false,
    });
    await repo.checkIn(fx.actor, {
      personId: ben,
      at: '2027-07-05T09:00:00.000Z',
      method: 'manual',
      overrideReason: null,
      note: null,
      sessionId: session.id,
      sessionUnassigned: true,
    });
    await repo.checkOut(fx.actor, {
      personId: ben,
      at: '2027-07-05T10:00:00.000Z',
      collectedByPersonId: null,
      overrideReason: null,
      note: null,
    });

    const who = async (extra: Partial<Parameters<PgAttendanceRepository['log']>[2]>) =>
      (await repo.log(fx.actor.userId, fx.actor.orgId, { ...WINDOW, ...extra })).map(v => v.personId);

    expect(await who({ sessionId: session.id })).toHaveLength(2);
    expect(await who({ classId: seriesId })).toEqual([kim]);
    expect(await who({ method: 'manual' })).toEqual([ben]);
    expect(await who({ checkedInBy: fx.actor.userId })).toHaveLength(2);
    expect(await who({ onSiteOnly: true })).toEqual([kim]);
    expect(await who({ checkedOutOnly: true })).toEqual([ben]);
    expect(await who({ sessionId: session.id, method: 'manual', checkedOutOnly: true })).toEqual([ben]);
    expect(await who({ classId: seriesId, method: 'manual' })).toEqual([]);

    const options = await repo.filterOptions(fx.actor.userId, fx.actor.orgId);
    expect(options.sessions).toContainEqual({ id: session.id, name: session.name });
    expect(options.classes).toContainEqual({ id: seriesId, name: series.rows[0]?.name ?? '', sessionId: session.id });
  });

  it('a camp-day visit has no session and no class', async () => {
    const person = await fx.addPerson(fx.orgA, '2015-03-01', 'Cy');

    await repo.checkIn(fx.actor, {
      personId: person,
      at: MORNING,
      method: 'manual',
      overrideReason: null,
      note: null,
      sessionId: null,
      sessionUnassigned: false,
    });

    expect(await logged(person)).toMatchObject({ sessionId: null, sessionName: null, classId: null, className: null });
  });
});
