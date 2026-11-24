import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { PgAttendanceRepository } from '../PgAttendanceRepository';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { samplePerson, type RepositoryFixture } from '../../people/__tests__/fixture';

const url = process.env.DATABASE_URL;
const MORNING = '2027-07-10T08:00:00.000Z';

/** The session columns on check_ins (migration 0049): a nullable session and an unassigned flag, row-level security as before. */
describe.skipIf(!url)('per-session check-in columns on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 3, application_name: 'buxa-checkin-session' });
  let fx: RepositoryFixture;
  let repo: PgAttendanceRepository;

  beforeAll(async () => {
    await migrate(pool);
    fx = await createPgFixture(pool);
    repo = new PgAttendanceRepository(pool);
  }, 120_000);
  afterAll(async () => {
    await fx?.close();
    await pool.end();
  });

  const session = async (actorForCamp = fx.actor): Promise<string> =>
    (
      await fx.repos.classes.createSession(actorForCamp, {
        name: 'Summer one',
        description: '',
        startsOn: '2027-07-01',
        endsOn: '2027-07-31',
      })
    ).id;

  it('adds a nullable session_id and a flag that is not null and defaults to false', async () => {
    const { rows } = await pool.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
      `SELECT column_name, is_nullable, column_default FROM information_schema.columns
        WHERE table_name = 'check_ins' AND column_name IN ('session_id', 'session_unassigned')`,
    );
    const byName = new Map(rows.map(r => [r.column_name, r]));
    expect(byName.get('session_id')?.is_nullable).toBe('YES');
    expect(byName.get('session_unassigned')?.is_nullable).toBe('NO');
    expect(byName.get('session_unassigned')?.column_default).toContain('false');
  });

  it('a camp-day check-in with no session stores a null session and no flag', async () => {
    const person = (await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Camp' }))).id;

    await repo.checkIn(fx.actor, {
      personId: person,
      at: MORNING,
      method: 'qr',
      overrideReason: null,
      note: null,
      sessionId: null,
      sessionUnassigned: false,
    });

    const visit = await repo.openFor(fx.actor.userId, fx.actor.orgId, person);
    expect(visit).toMatchObject({ sessionId: null, sessionUnassigned: false });
  });

  it('records the session and the flag, and reads them back', async () => {
    const sessionId = await session();
    const person = (await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Flagged' }))).id;

    await repo.checkIn(fx.actor, {
      personId: person,
      at: MORNING,
      method: 'search',
      overrideReason: null,
      note: null,
      sessionId,
      sessionUnassigned: true,
    });

    const visit = await repo.openFor(fx.actor.userId, fx.actor.orgId, person);
    expect(visit).toMatchObject({ sessionId, sessionUnassigned: true });
  });

  it('refuses a session that belongs to another camp', async () => {
    const otherSession = await session(fx.otherActor);
    const person = (await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Stray' }))).id;

    await expect(
      repo.checkIn(fx.actor, {
        personId: person,
        at: MORNING,
        method: 'manual',
        overrideReason: null,
        note: null,
        sessionId: otherSession,
        sessionUnassigned: false,
      }),
    ).rejects.toThrow();
  });
});
