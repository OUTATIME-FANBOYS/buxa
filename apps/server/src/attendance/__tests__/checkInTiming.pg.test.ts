import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import type { NewPersonInput } from '@buxa/contracts';
import { createServices } from '../../runtime';
import { systemClock } from '../../services/clock';
import { createPgFixture } from '../../people/__tests__/pgFixture';
import type { RepositoryFixture } from '../../people/__tests__/fixture';
import { formatSummary, summarize } from '@buxa/shared/timing/stats';

const url = process.env.DATABASE_URL;

/**
 * SERVER budget for the scan + check-in path: the p95 of the server-side time must stay under this. It is a regression guard on
 * the database and the services, NOT the phone budget. The phone budget is 5 seconds from scan to the green result on a real
 * phone (docs/phases/01-check-in-timing.md), which also includes the phone, the network and the staff member's taps.
 */
const SERVER_P95_BUDGET_MS = 1000;

const CAMP_PEOPLE = 300;
/** People already on site, so the scan reads a realistic on-site list. They are checked in before timing starts. */
const ALREADY_ON_SITE = 50;
const TIMED_CHECK_INS = 100;
const SEED_CONCURRENCY = 10;

/**
 * The server half of "a staff member checks in a member in under 5 seconds". Times the same service calls that `scanCodeAction`
 * and `checkInAction` make (the action wrapper adds a session check and a rate limit, which are not timed here), against the
 * real Postgres database with row-level security on. Each timed visit is checked out again afterwards to keep the state clean.
 */
describe.skipIf(!url)('check-in timing on Postgres', () => {
  const pool = new pg.Pool({ connectionString: url, max: 5, application_name: 'buxa-checkin-timing' });
  let fx: RepositoryFixture;

  beforeAll(async () => {
    // Badges are sealed with BADGE_ENCRYPTION_KEY: a fixed test key, for this run only.
    vi.stubEnv('BADGE_ENCRYPTION_KEY', Buffer.alloc(32, 4).toString('base64'));
    await migrate(pool);
    fx = await createPgFixture(pool);
  }, 120_000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await fx?.close();
    await pool.end();
  });

  it(`scan then check-in for ${TIMED_CHECK_INS} members, p95 under ${SERVER_P95_BUDGET_MS} ms on the server`, async () => {
    const services = createServices(fx.repos, systemClock);
    const actor = fx.actor;

    // 300 people, each with a valid membership and a badge, created through the services so the rules and audit rows apply.
    const people: { personId: string; payload: string }[] = [];
    for (let start = 0; start < CAMP_PEOPLE; start += SEED_CONCURRENCY) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(SEED_CONCURRENCY, CAMP_PEOPLE - start) }, async (_, offset) => {
          const index = start + offset;
          const input: NewPersonInput = { givenName: `Member ${index}`, familyName: 'Timing', roles: ['participant'] };
          const person = await services.people.create(actor, input);
          await services.memberships.add(actor, {
            personId: person.id,
            plan: 'Season pass',
            startsOn: '2020-01-01',
            endsOn: '2099-12-31',
          });
          const badge = await services.credentials.issue(actor, person.id);

          return { personId: person.id, payload: badge.payload };
        }),
      );
      people.push(...batch);
    }
    expect(people).toHaveLength(CAMP_PEOPLE);

    for (const person of people.slice(0, ALREADY_ON_SITE)) {
      const result = await services.attendance.checkIn(actor, { personId: person.personId, method: 'qr' });
      expect(result.ok).toBe(true);
    }

    const scanMs: number[] = [];
    const checkInMs: number[] = [];
    const pathMs: number[] = [];
    for (const person of people.slice(ALREADY_ON_SITE, ALREADY_ON_SITE + TIMED_CHECK_INS)) {
      const started = performance.now();
      const scan = await services.credentials.scan(actor, person.payload);
      await services.attendance.onSite(actor);
      const scanned = performance.now();
      if (scan.kind !== 'person') {
        throw new Error('A freshly issued badge did not scan as a person.');
      }

      const result = await services.attendance.checkIn(actor, { personId: person.personId, method: 'qr' });
      const checked = performance.now();
      if (!result.ok) {
        throw new Error(`Check-in refused in the timing run: ${result.reason}`);
      }

      scanMs.push(scanned - started);
      checkInMs.push(checked - scanned);
      pathMs.push(checked - started);

      // Untimed clean-up, so the next visit starts from the same state.
      const out = await services.attendance.checkOut(actor, { personId: person.personId });
      expect(out.ok).toBe(true);
    }

    const scan = summarize(scanMs);
    const checkIn = summarize(checkInMs);
    const path = summarize(pathMs);
    console.log(
      [
        formatSummary('scan (scan + on-site list)', scan),
        formatSummary('check-in', checkIn),
        formatSummary('scan to check-in response', path),
        `server budget (p95 of scan to check-in response): ${SERVER_P95_BUDGET_MS} ms`,
      ].join('\n'),
    );

    expect(path.count).toBe(TIMED_CHECK_INS);
    expect(path.p95).toBeLessThan(SERVER_P95_BUDGET_MS);
  }, 300_000);
});
