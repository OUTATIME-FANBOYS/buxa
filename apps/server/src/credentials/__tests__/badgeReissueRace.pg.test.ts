import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import { samplePerson, tokenHash, type RepositoryFixture } from '../../people/__tests__/fixture';
import { untilBlocked } from '../../__tests__/untilBlocked';
import { translateRepositoryError } from '../../services/shared/errors';
import { isBadgeConflict } from '../CredentialRepository';

const url = process.env.DATABASE_URL;

// Audit S-15. A badge issue waits behind another issue for the same person, on the active-badge unique index. The
// loser must get the conflict error (a 409 through translateRepositoryError), not a raw Postgres 23505 that becomes a 500.
describe.skipIf(!url)('concurrent badge reissue on Postgres (S-15)', () => {
  const pool = new pg.Pool({ connectionString: url, max: 5, application_name: 'buxa-race-badge' });
  let fx: RepositoryFixture;

  beforeAll(async () => {
    await migrate(pool);
    fx = await createPgFixture(pool);
  });
  afterAll(async () => {
    await fx?.close();
    await pool.end();
  });

  it('an issue blocked by an uncommitted one for the same person is a BadgeConflictError (409), and one active badge remains', async () => {
    const personId = (await fx.repos.people.create(fx.actor, samplePerson({ givenName: 'Badge' }))).id;
    const at = '2027-07-01T09:00:00.000Z';

    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SET LOCAL ROLE buxa_app');
      await holder.query("SELECT set_config('app.org_id', $1, true)", [fx.actor.orgId]);
      await holder.query(
        `INSERT INTO credentials (org_id, person_id, token_hash, issued_at, issued_by) VALUES ($1, $2, $3, $4::timestamptz, $5)`,
        [fx.actor.orgId, personId, tokenHash('winner'), at, fx.actor.userId],
      );

      const loser$ = fx.repos.credentials.issue(fx.actor, personId, tokenHash('loser'), at).then(
        () => 'issued' as const,
        (error: unknown) => error,
      );
      await untilBlocked(pool, 'buxa-race-badge');
      await holder.query('COMMIT');

      const outcome = await loser$;
      expect(isBadgeConflict(outcome)).toBe(true);
      expect(translateRepositoryError(outcome)).toMatchObject({ statusCode: 409 });
    } finally {
      holder.release();
    }

    const active = await withOrg(
      pool,
      fx.actor.orgId,
      async db =>
        (
          await db.query<{ n: number }>(
            'SELECT count(*)::int AS n FROM credentials WHERE person_id = $1 AND revoked_at IS NULL',
            [personId],
          )
        ).rows[0].n,
    );
    expect(active).toBe(1);
  });
});
