import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createClassFixture, makeSession, sessionInput, type ClassFixture } from '../classes/__tests__/pgClassFixture';
import { PgCalendarRepository } from './PgCalendarRepository';
import { hashCalendarToken } from './calendarToken';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('calendar feed on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  let repo: PgCalendarRepository;
  beforeEach(async () => {
    fx = await createClassFixture(pool);
    repo = new PgCalendarRepository(pool);
  });
  afterEach(async () => {
    await fx.close();
  });

  it('resolves a token hash to its camp, and nothing for another hash', async () => {
    const hash = hashCalendarToken(`token-${fx.orgA}`);
    await repo.saveTokenHash(fx.actor, hash);

    expect(await repo.findCampByTokenHash(hash)).toMatchObject({ orgId: fx.orgA, archived: false });
    expect(await repo.findCampByTokenHash(hashCalendarToken('some other token'))).toBeNull();
  });

  it('rotating replaces the hash: the old one no longer resolves', async () => {
    const first = hashCalendarToken(`first-${fx.orgA}`);
    const second = hashCalendarToken(`second-${fx.orgA}`);
    await repo.saveTokenHash(fx.actor, first);
    await repo.saveTokenHash(fx.actor, second);

    expect(await repo.findCampByTokenHash(first)).toBeNull();
    expect(await repo.findCampByTokenHash(second)).toMatchObject({ orgId: fx.orgA });
  });

  it('reports an archived camp as archived, so the service can refuse it', async () => {
    const hash = hashCalendarToken(`archived-${fx.orgA}`);
    await repo.saveTokenHash(fx.actor, hash);
    await pool.query('UPDATE orgs SET archived_at = now() WHERE id = $1', [fx.orgA]);

    expect(await repo.findCampByTokenHash(hash)).toMatchObject({ orgId: fx.orgA, archived: true });
    await pool.query('UPDATE orgs SET archived_at = NULL WHERE id = $1', [fx.orgA]);
  });

  it('writes the audit entry in the same transaction and never the token', async () => {
    const hash = hashCalendarToken(`audited-${fx.orgA}`);
    await repo.saveTokenHash(fx.actor, hash);

    const rows = await pool.query<{ action: string; data: string }>(
      "SELECT action, data::text AS data FROM audit_log WHERE org_id = $1 AND action = 'calendar.token_rotate'",
      [fx.orgA],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].data).not.toContain(hash.toString('hex'));
  });

  it("lists only the camp's own classes in the feed (another camp sees none of them)", async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.addClasses(fx.actor, session.id, [sessionInput(9, 10)]);

    const tokenA = randomBytes(32);
    const tokenB = randomBytes(32);
    await repo.saveTokenHash(fx.actor, tokenA);
    await repo.saveTokenHash(fx.otherActor, tokenB);
    const mine = await repo.listFeedClasses(tokenA);
    const theirs = await repo.listFeedClasses(tokenB);

    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ className: 'Robotics', location: 'Lab 1' });
    expect(theirs).toEqual([]);
  });
});
