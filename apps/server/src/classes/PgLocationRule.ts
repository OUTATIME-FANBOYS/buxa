import { nameKey } from '@buxa/domain';
import { type Db } from '../people/pgRows';
import { assertNoLocationClash, dayOf, type ExistingPlace } from './locationClash';

/** The times a write puts a class on. */
export interface PlacedTimes {
  startsAt: string;
  endsAt: string;
}

/**
 * The location rule under a write (v0.4, migration 0066). Takes a transaction lock on the camp's location, so two writes for one place
 * run one after the other, then reads the active classes in that place and applies the rule the service applies (assertNoLocationClash).
 * Runs inside the caller's transaction, so the check and the write commit or fail together. The exclusion constraint on sessions is the
 * last line of defence; this check is what gives the readable refusal, and it is the one that sees the rows another write has just
 * committed (the lock is held until then).
 *
 * `ownSeriesId` leaves out the series being written (its own days never overlap each other in one place).
 */
export async function lockLocationAndCheck(
  db: Db,
  orgId: string,
  subject: { name: string; location: string },
  times: readonly PlacedTimes[],
  ownSeriesId: string | null,
): Promise<void> {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `class-location:${orgId}:${nameKey(subject.location)}`,
  ]);
  const { rows: zones } = await db.query<{ timezone: string }>('SELECT timezone FROM orgs WHERE id = $1', [orgId]);
  const timeZone = zones[0]?.timezone ?? 'UTC';
  const { rows } = await db.query<{
    name: string;
    location: string;
    starts_at: Date;
    ends_at: Date;
    series_id: string;
  }>(`SELECT name, location, starts_at, ends_at, series_id FROM sessions WHERE org_id = $1 AND status = 'active'`, [
    orgId,
  ]);
  const existing: ExistingPlace[] = rows
    .filter(r => r.series_id !== ownSeriesId)
    .map(r => ({
      className: r.name,
      location: r.location,
      startsAt: r.starts_at.toISOString(),
      endsAt: r.ends_at.toISOString(),
    }));
  assertNoLocationClash(
    subject,
    times.map(t => dayOf(t, timeZone)),
    existing,
    timeZone,
  );
}
