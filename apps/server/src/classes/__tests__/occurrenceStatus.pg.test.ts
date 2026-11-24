import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { OccurrenceRefusedError } from '../errors';
import { auditActions, createClassFixture, makeSession, sessionInput, type ClassFixture } from './pgClassFixture';

const url = process.env.DATABASE_URL;

interface DayRow {
  id: string;
  status: string;
  cancel_reason: string | null;
  cancelled: boolean;
}

describe.skipIf(!url)('cancelling and restoring one day on Postgres', () => {
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

  const daysOf = async (sessionId: string): Promise<DayRow[]> => {
    const { rows } = await pool.query<DayRow>(
      `SELECT id, status, cancel_reason, cancelled_at IS NOT NULL AS cancelled
         FROM sessions WHERE class_id = $1 ORDER BY starts_at, id`,
      [sessionId],
    );

    return rows;
  };

  it('stores the cancellation and its reason on that day only, and audits it in the same change', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const morning = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
    const afternoon = await fx.repo.addClass(fx.actor, session.id, sessionInput(13, 16));

    await fx.repo.setOccurrenceStatus(fx.actor, morning.id, { kind: 'cancel', reason: 'Public holiday' });

    const days = await daysOf(session.id);
    expect(days).toHaveLength(2);
    expect(days.find(d => d.id === morning.id)).toEqual({
      id: morning.id,
      status: 'cancelled',
      cancel_reason: 'Public holiday',
      cancelled: true,
    });
    expect(days.find(d => d.id === afternoon.id)).toEqual({
      id: afternoon.id,
      status: 'active',
      cancel_reason: null,
      cancelled: false,
    });
    expect(await auditActions(pool, fx.orgA)).toContain('occurrence.cancel');
  });

  it('clears the cancellation on restore, and audits the restore', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
    await fx.repo.setOccurrenceStatus(fx.actor, cls.id, { kind: 'cancel', reason: 'Rain day' });
    await fx.repo.setOccurrenceStatus(fx.actor, cls.id, { kind: 'restore' });

    expect((await daysOf(session.id))[0]).toEqual({
      id: cls.id,
      status: 'active',
      cancel_reason: null,
      cancelled: false,
    });
    expect(await auditActions(pool, fx.orgA)).toEqual(
      expect.arrayContaining(['occurrence.cancel', 'occurrence.restore']),
    );
  });

  it('a refused cancel changes nothing and writes no audit entry', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    const cls = await fx.repo.addClass(fx.actor, session.id, sessionInput(9, 12));
    await fx.repo.setOccurrenceStatus(fx.actor, cls.id, { kind: 'cancel', reason: 'Holiday' });

    await expect(
      fx.repo.setOccurrenceStatus(fx.actor, cls.id, { kind: 'cancel', reason: 'Holiday again' }),
    ).rejects.toBeInstanceOf(OccurrenceRefusedError);

    const actions = await auditActions(pool, fx.orgA);
    expect(actions.filter(a => a === 'occurrence.cancel')).toHaveLength(1);
    expect((await daysOf(session.id))[0]?.cancel_reason).toBe('Holiday');
  });
});
