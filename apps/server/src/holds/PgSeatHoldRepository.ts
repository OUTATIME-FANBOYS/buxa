import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import type { PlaceHoldRequest, SeatHold, SeatHoldRepository } from './SeatHoldRepository';
import { placeHoldInTransaction, releaseExpiredHolds, releaseHoldInTransaction } from './PgSeatHoldWrites';

/**
 * Postgres adapter for seat holds. Every call runs in withOrg (row-level security); the writes take the session lock and write
 * their audit entries in the same transaction. Refusals throw from inside the transaction, so nothing is written for them.
 */
export class PgSeatHoldRepository implements SeatHoldRepository {
  constructor(private readonly pool: Pool) {}

  placeHold(actor: Actor, request: PlaceHoldRequest): Promise<SeatHold> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => placeHoldInTransaction(db, actor, request));
  }

  releaseHold(actor: Actor, holdId: string): Promise<SeatHold> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => releaseHoldInTransaction(db, actor, holdId));
  }

  releaseExpiredHolds(userId: string | null, orgId: string): Promise<number> {
    return withOrg(this.pool, userId, orgId, db => releaseExpiredHolds(db, { userId: null, orgId }));
  }

  /** A SECURITY DEFINER function (migration 0043) lists the camps and one member of each, so the job can see their holds. */
  async campsWithExpiredHolds(): Promise<{ orgId: string; userId: string }[]> {
    const { rows } = await this.pool.query<{ org_id: string; user_id: string | null }>(
      `SELECT org_id, user_id FROM buxa_orgs_with_expired_holds()`,
    );

    // A camp with no member cannot be read under row-level security, and its holds count for nothing, so it is skipped.
    return rows.flatMap(row => (row.user_id === null ? [] : [{ orgId: row.org_id, userId: row.user_id }]));
  }
}
