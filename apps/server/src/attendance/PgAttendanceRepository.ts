import type { Pool } from 'pg';
import { withOrg, isUniqueViolation } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { personExists, requirePerson } from '../people/PgPersonQueries';
import { closeVisit, insertCheckIn } from './PgCheckInWrites';
import { openVisit, queryCheckIns, requireCheckIn } from './PgCheckInQueries';
import { AlreadyCheckedInError, MAX_LOG_ROWS, NotOnSiteError, type AttendanceQuery, type AttendanceRepository, type CheckInRecord, type NewCheckIn, type NewCheckOut } from './AttendanceRepository';

/** Postgres adapter for check-ins. The partial unique index is the final guard against a second open visit, even under a race. */
export class PgAttendanceRepository implements AttendanceRepository {
  constructor(private readonly pool: Pool) {}

  openFor(orgId: string, personId: string): Promise<CheckInRecord | null> {
    return withOrg(this.pool, orgId, db => openVisit(db, personId));
  }

  onSite(orgId: string): Promise<CheckInRecord[]> {
    return withOrg(this.pool, orgId, db => queryCheckIns(db, 'WHERE checked_out_at IS NULL', [], 'ORDER BY checked_in_at, id'));
  }

  async checkIn(actor: Actor, input: NewCheckIn): Promise<CheckInRecord> {
    try {
      return await withOrg(this.pool, actor.orgId, async db => {
        if (!(await personExists(db, input.personId))) throw new PersonNotFoundError();
        const id = await insertCheckIn(db, actor, input);
        return requireCheckIn(db, id);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new AlreadyCheckedInError() : error;
    }
  }

  checkOut(actor: Actor, input: NewCheckOut): Promise<CheckInRecord> {
    return withOrg(this.pool, actor.orgId, async db => {
      const visit = await openVisit(db, input.personId);
      if (!visit) throw new NotOnSiteError();
      if (input.collectedByPersonId !== null) await requirePerson(db, input.collectedByPersonId);
      await closeVisit(db, actor, visit, input);
      return requireCheckIn(db, visit.id);
    });
  }

  log(orgId: string, query: AttendanceQuery): Promise<CheckInRecord[]> {
    if (query.personId !== undefined && !isUuid(query.personId)) return Promise.resolve([]);
    return withOrg(this.pool, orgId, db => queryCheckIns(
      db,
      `WHERE checked_in_at >= $1::timestamptz AND checked_in_at < $2::timestamptz
         AND ($3::uuid IS NULL OR person_id = $3::uuid)
         AND (NOT $4::boolean OR checked_out_at IS NULL)`,
      [query.from, query.to, query.personId ?? null, query.onSiteOnly === true],
      'ORDER BY checked_in_at DESC, id DESC',
      MAX_LOG_ROWS,
    ));
  }
}
