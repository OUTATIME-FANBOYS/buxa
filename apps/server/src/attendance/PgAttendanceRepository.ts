import type { Pool } from 'pg';
import { withOrg, isUniqueViolation } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import { PersonNotFoundError } from '../people/PeopleRepository';
import { personExists, requirePerson } from '../people/PgPersonQueries';
import { closeVisit, insertCheckIn } from './PgCheckInWrites';
import { openVisit, queryCheckIns, requireCheckIn } from './PgCheckInQueries';
import {
  AlreadyCheckedInError,
  MAX_LOG_ROWS,
  NotOnSiteError,
  type AttendanceFilterOptions,
  type AttendanceQuery,
  type AttendanceRepository,
  type CheckInRecord,
  type NewCheckIn,
  type NewCheckOut,
} from './AttendanceRepository';

/** Postgres adapter for check-ins. The partial unique index is the final guard against a second open visit, even under a race. */
export class PgAttendanceRepository implements AttendanceRepository {
  constructor(private readonly pool: Pool) {}

  openFor(userId: string, orgId: string, personId: string): Promise<CheckInRecord | null> {
    return withOrg(this.pool, userId, orgId, db => openVisit(db, personId));
  }

  onSite(userId: string, orgId: string): Promise<CheckInRecord[]> {
    return withOrg(this.pool, userId, orgId, db =>
      queryCheckIns(db, 'WHERE checked_out_at IS NULL', [], 'ORDER BY checked_in_at, id'),
    );
  }

  async checkIn(actor: Actor, input: NewCheckIn): Promise<CheckInRecord> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        if (!(await personExists(db, input.personId))) {
          throw new PersonNotFoundError();
        }
        const id = await insertCheckIn(db, actor, input);

        return requireCheckIn(db, id);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new AlreadyCheckedInError() : error;
    }
  }

  checkOut(actor: Actor, input: NewCheckOut): Promise<CheckInRecord> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      const visit = await openVisit(db, input.personId);
      if (!visit) {
        throw new NotOnSiteError();
      }
      if (input.collectedByPersonId !== null) {
        await requirePerson(db, input.collectedByPersonId);
      }
      await closeVisit(db, actor, visit, input);

      return requireCheckIn(db, visit.id);
    });
  }

  log(userId: string, orgId: string, query: AttendanceQuery): Promise<CheckInRecord[]> {
    const ids = [query.personId, query.sessionId, query.classId, query.checkedInBy];
    if (ids.some(id => id !== undefined && !isUuid(id))) {
      return Promise.resolve([]);
    }

    return withOrg(this.pool, userId, orgId, db =>
      queryCheckIns(
        db,
        `WHERE checked_in_at >= $1::timestamptz AND checked_in_at < $2::timestamptz
         AND ($3::uuid IS NULL OR person_id = $3::uuid)
         AND (NOT $4::boolean OR checked_out_at IS NULL)
         AND ($5::uuid IS NULL OR session_id = $5::uuid)
         AND ($6::uuid IS NULL OR class_id = $6::uuid)
         AND ($7::text IS NULL OR method = $7::text)
         AND ($8::uuid IS NULL OR checked_in_by = $8::uuid)
         AND (NOT $9::boolean OR checked_out_at IS NOT NULL)`,
        [
          query.from,
          query.to,
          query.personId ?? null,
          query.onSiteOnly === true,
          query.sessionId ?? null,
          query.classId ?? null,
          query.method ?? null,
          query.checkedInBy ?? null,
          query.checkedOutOnly === true,
        ],
        'ORDER BY checked_in_at DESC, id DESC',
        MAX_LOG_ROWS,
      ),
    );
  }

  filterOptions(userId: string, orgId: string): Promise<AttendanceFilterOptions> {
    return withOrg(this.pool, userId, orgId, async db => {
      const [sessions, classes] = await Promise.all([
        db.query<{ id: string; name: string }>('SELECT id, name FROM classes ORDER BY name, id'),
        db.query<{ id: string; name: string; session_id: string }>(
          'SELECT id, name, class_id AS session_id FROM class_series ORDER BY name, id',
        ),
      ]);

      return {
        sessions: sessions.rows,
        classes: classes.rows.map(row => ({ id: row.id, name: row.name, sessionId: row.session_id })),
      };
    });
  }
}
