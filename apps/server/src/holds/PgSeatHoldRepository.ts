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

  releaseExpiredHolds(userId: string, orgId: string): Promise<number> {
    return withOrg(this.pool, userId, orgId, db => releaseExpiredHolds(db, { userId: null, orgId }));
  }
}
