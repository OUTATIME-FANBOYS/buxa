import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import { createClassFixture, makeSession, sessionInput, type ClassFixture } from '../classes/__tests__/pgClassFixture';
import { PgPublicSessionRepository } from './PgPublicSessionRepository';
import { createPublicSessionService } from './PublicSessionService';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('public session pages on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  let fx: ClassFixture;
  let repo: PgPublicSessionRepository;
  let slugA: string;
  beforeEach(async () => {
    fx = await createClassFixture(pool);
    repo = new PgPublicSessionRepository(pool);
    const { rows } = await pool.query<{ slug: string }>('SELECT slug FROM orgs WHERE id = $1', [fx.orgA]);
    slugA = rows[0].slug;
  });
  afterEach(async () => {
    await fx.close();
  });

  const now = new Date('2027-07-01T00:00:00Z');

  it('a session is private by default: the page finds nothing until staff mark it public', async () => {
    const session = await makeSession(fx.repo, fx.actor);

    expect(await repo.findPublicSession(slugA, session.id)).toBeNull();

    await fx.repo.setSessionPublic(fx.actor, session.id, true);
    expect(await repo.findPublicSession(slugA, session.id)).toMatchObject({
      campName: 'Class test camp',
      sessionName: 'Summer camp',
      startsOn: '2027-07-01',
      endsOn: '2027-07-31',
    });
  });

  it('shows the classes that have not ended, with only their name, ages, times and location', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.setSessionPublic(fx.actor, session.id, true);
    const instructor = await fx.addPerson(fx.orgA, '1980-01-01', 'Secret');
    await fx.repo.addClasses(fx.actor, session.id, [
      sessionInput(9, 12, { name: 'Robotics', instructorIds: [instructor], capacity: 3 }),
    ]);

    const service = createPublicSessionService({ repo });
    const page = await service.getPage(slugA, session.id, now);
    expect(page?.classes).toEqual([
      {
        name: 'Robotics',
        ageRange: { minAge: 8, maxAge: 12 },
        location: 'Lab 1',
        startsAt: '2027-07-04T23:00:00.000Z',
        endsAt: '2027-07-05T02:00:00.000Z',
        price: null,
      },
    ]);

    // Nothing about who teaches, who is enrolled, or the seats appears in the page's data.
    const text = JSON.stringify(page);
    expect(text).not.toContain('Secret');
    expect(text).not.toMatch(/capacity|seats|enrol|waitlist/i);
  });

  it('shows each class its own price, read from the class row through the public function', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.setSessionPublic(fx.actor, session.id, true);
    await fx.repo.addClass(fx.actor, session.id, {
      ...sessionInput(9, 12, { name: 'Painting' }),
      price: { currency: 'AUD', regularMinor: 45000, earlyBirdMinor: 39900, earlyBirdUntil: '2027-07-05' },
    });

    const service = createPublicSessionService({ repo });
    const page = await service.getPage(slugA, session.id, now);
    expect(page?.classes.map(c => c.price)).toEqual([
      { currency: 'AUD', regularMinor: 45000, earlyBirdMinor: 39900, earlyBirdUntil: '2027-07-05' },
    ]);
  });

  it('hides a public session once its camp is archived', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.setSessionPublic(fx.actor, session.id, true);
    await pool.query('UPDATE orgs SET archived_at = now() WHERE id = $1', [fx.orgA]);

    expect(await repo.findPublicSession(slugA, session.id)).toBeNull();
    await pool.query('UPDATE orgs SET archived_at = NULL WHERE id = $1', [fx.orgA]);
  });

  it('returns nothing for another camp slug, even with the right session id', async () => {
    const session = await makeSession(fx.repo, fx.actor);
    await fx.repo.setSessionPublic(fx.actor, session.id, true);

    expect(await repo.findPublicSession(`${slugA}-other`, session.id)).toBeNull();
  });
});
