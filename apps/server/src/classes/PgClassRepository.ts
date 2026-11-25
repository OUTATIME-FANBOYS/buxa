import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor, type DatesPlanClass } from '@buxa/domain';
import type {
  Class,
  Enrolment,
  NewSessionInput,
  Series,
  Session,
  SessionDeleteImpact,
  SessionEditInput,
} from '@buxa/contracts';
import type {
  CampActiveHold,
  CampClassSpan,
  CampWaitlistEntry,
  ClassRecord,
  ClassRepository,
  EnrolRequest,
  EnrolmentRule,
  SeriesFields,
  SeriesRecord,
  SeriesSchedule,
} from './ClassRepository';
import { deleteSeriesRow, insertSeries, updateSeriesRow } from './PgSeriesWrites';
import { getSeriesRow, listSeriesDayRows, listSeriesHolderNames, listSeriesRows } from './PgSeriesQueries';
import { ClassNotFoundError } from './errors';
import { cancelInTransaction, enrolInTransaction } from './PgEnrolmentWrites';
import { readDatesPlanRows } from './PgSessionDates';
import {
  getClass,
  getSession,
  getSessionDeleteImpact,
  listClassRows,
  listEnrolmentRows,
  listSessionRows,
  requireClass,
  requireClassExists,
  requireSession,
  requireSessionExists,
} from './PgClassQueries';
import {
  deleteClassRow,
  deleteDraftSessionRow,
  deleteSessionRow,
  deleteSessionWithClassesRow,
  insertClass,
  insertSession,
  publishSessionRow,
  setSessionArchivedRow,
  setSessionPublicRow,
  setOccurrenceStatusRow,
  updateClassRow,
  updateSessionRow,
} from './PgClassWrites';
import type { OccurrenceCommand } from '@buxa/domain';
import {
  translateClassWriteError,
  translateEnrolmentWriteError,
  translateSessionDeleteError,
  translateSessionNameError,
} from './pgClassErrors';
import { listCampActiveHoldRows, listCampWaitlistRows } from './PgCampQueries';
import { toIso } from '../people/pgRows';

/**
 * Postgres adapter for sessions, classes and enrolments. Every call runs in withOrg (row-level security), and every write
 * writes its audit entry in the same transaction. Refusals are thrown from inside the transaction, so nothing is written for them.
 * Driver errors are translated to the domain errors in ./errors.ts (see pgClassErrors.ts) before they leave this file.
 */
export class PgClassRepository implements ClassRepository {
  constructor(private readonly pool: Pool) {}

  listSessions(userId: string, orgId: string): Promise<Session[]> {
    return withOrg(this.pool, userId, orgId, listSessionRows);
  }

  getSession(userId: string, orgId: string, sessionId: string): Promise<Session | null> {
    return withOrg(this.pool, userId, orgId, db => getSession(db, sessionId));
  }

  async createSession(actor: Actor, input: NewSessionInput): Promise<Session> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const id = await insertSession(db, actor, input);

        return requireSession(db, id);
      });
    } catch (error) {
      throw translateSessionNameError(error, input.name);
    }
  }

  async updateSession(actor: Actor, sessionId: string, input: SessionEditInput): Promise<Session> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        await updateSessionRow(db, actor, sessionId, input);

        return requireSession(db, sessionId);
      });
    } catch (error) {
      throw translateSessionNameError(error, input.name);
    }
  }

  sessionDatesPlanRows(userId: string, orgId: string, sessionId: string): Promise<DatesPlanClass[]> {
    return withOrg(this.pool, userId, orgId, db => readDatesPlanRows(db, orgId, sessionId));
  }

  sessionNameTaken(userId: string, orgId: string, name: string, exceptId: string | null): Promise<string | null> {
    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<{ name: string }>(
        `SELECT name FROM classes
          WHERE buxa_name_key(name) = buxa_name_key($1) AND ($2::uuid IS NULL OR id <> $2::uuid)
          LIMIT 1`,
        [name, exceptId],
      );

      return rows[0]?.name ?? null;
    });
  }

  setSessionArchived(actor: Actor, sessionId: string, archived: boolean): Promise<Session> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await setSessionArchivedRow(db, actor, sessionId, archived);

      return requireSession(db, sessionId);
    });
  }

  publishSession(actor: Actor, sessionId: string): Promise<Session> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await publishSessionRow(db, actor, sessionId);

      return requireSession(db, sessionId);
    });
  }

  sessionDeleteImpact(userId: string, orgId: string, sessionId: string): Promise<SessionDeleteImpact> {
    return withOrg(this.pool, userId, orgId, db => getSessionDeleteImpact(db, sessionId));
  }

  async deleteDraftSession(actor: Actor, sessionId: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const existing = await requireSession(db, sessionId);
        const impact = await getSessionDeleteImpact(db, sessionId);
        await deleteDraftSessionRow(db, actor, sessionId, existing.name, impact);
      });
    } catch (error) {
      throw translateSessionDeleteError(error);
    }
  }

  async deleteSessionWithClasses(actor: Actor, sessionId: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const existing = await requireSession(db, sessionId);
        await deleteSessionWithClassesRow(db, actor, sessionId, existing.name);
      });
    } catch (error) {
      throw translateSessionDeleteError(error);
    }
  }

  async deleteSession(actor: Actor, sessionId: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const existing = await requireSession(db, sessionId);
        await deleteSessionRow(db, actor, sessionId, existing.name);
      });
    } catch (error) {
      throw translateSessionDeleteError(error);
    }
  }

  setSessionPublic(actor: Actor, sessionId: string, isPublic: boolean): Promise<Session> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await setSessionPublicRow(db, actor, sessionId, isPublic);

      return requireSession(db, sessionId);
    });
  }

  setOccurrenceStatus(actor: Actor, occurrenceId: string, command: OccurrenceCommand): Promise<void> {
    return withOrg(this.pool, actor.userId, actor.orgId, db =>
      setOccurrenceStatusRow(db, actor, occurrenceId, command),
    );
  }

  async addSeries(actor: Actor, sessionId: string, input: SeriesRecord): Promise<Series> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        await requireSessionExists(db, sessionId);
        const seriesId = await insertSeries(db, actor, sessionId, input);
        const made = await getSeriesRow(db, seriesId);
        if (!made) {
          throw new ClassNotFoundError();
        }

        return made;
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  listSeries(userId: string, orgId: string, sessionId: string): Promise<Series[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      await requireSessionExists(db, sessionId);

      return listSeriesRows(db, sessionId);
    });
  }

  getSeries(userId: string, orgId: string, seriesId: string): Promise<Series | null> {
    return withOrg(this.pool, userId, orgId, db => getSeriesRow(db, seriesId));
  }

  listSeriesOccurrences(userId: string, orgId: string, seriesId: string): Promise<Class[]> {
    return withOrg(this.pool, userId, orgId, db => listSeriesDayRows(db, seriesId));
  }

  seriesHolders(userId: string, orgId: string, seriesId: string): Promise<string[]> {
    return withOrg(this.pool, userId, orgId, db => listSeriesHolderNames(db, seriesId));
  }

  async updateSeries(
    actor: Actor,
    seriesId: string,
    input: SeriesFields,
    schedule: SeriesSchedule | null,
  ): Promise<Series> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        await updateSeriesRow(db, actor, seriesId, input, schedule);
        const updated = await getSeriesRow(db, seriesId);
        if (!updated) {
          throw new ClassNotFoundError();
        }

        return updated;
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  async deleteSeries(actor: Actor, seriesId: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const existing = await getSeriesRow(db, seriesId);
        if (!existing) {
          throw new ClassNotFoundError();
        }
        await deleteSeriesRow(db, actor, seriesId, existing.name);
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  listCampClassSpans(userId: string, orgId: string): Promise<CampClassSpan[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<{ starts_at: Date; ends_at: Date; class_name: string; series_id: string | null }>(
        'SELECT s.starts_at, s.ends_at, s.name AS class_name, s.series_id FROM sessions s ORDER BY s.starts_at',
      );

      return rows.map(r => ({
        startsAt: toIso(r.starts_at),
        endsAt: toIso(r.ends_at),
        className: r.class_name,
        seriesId: r.series_id,
      }));
    });
  }

  listClasses(userId: string, orgId: string, sessionId: string): Promise<Class[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      await requireSessionExists(db, sessionId);

      return listClassRows(db, sessionId);
    });
  }

  getClass(userId: string, orgId: string, classId: string): Promise<Class | null> {
    return withOrg(this.pool, userId, orgId, db => getClass(db, classId));
  }

  addClass(actor: Actor, sessionId: string, input: ClassRecord): Promise<Class> {
    return withOrg(this.pool, actor.userId, actor.orgId, async db => {
      await requireSessionExists(db, sessionId);
      const id = await insertClass(db, actor, sessionId, input);

      return requireClass(db, id);
    });
  }

  async updateClass(actor: Actor, classId: string, input: ClassRecord): Promise<Class> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        await requireClassExists(db, classId);
        await updateClassRow(db, actor, classId, input);

        return requireClass(db, classId);
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  async deleteClass(actor: Actor, classId: string): Promise<void> {
    try {
      await withOrg(this.pool, actor.userId, actor.orgId, async db => {
        const existing = await requireClass(db, classId);
        await deleteClassRow(db, actor, classId, existing.name);
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  listEnrolments(userId: string, orgId: string, classId: string): Promise<Enrolment[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      await requireClassExists(db, classId);

      return listEnrolmentRows(db, classId);
    });
  }

  listCampActiveHolds(userId: string, orgId: string): Promise<CampActiveHold[]> {
    return withOrg(this.pool, userId, orgId, listCampActiveHoldRows);
  }

  listCampWaitlists(userId: string, orgId: string): Promise<CampWaitlistEntry[]> {
    return withOrg(this.pool, userId, orgId, listCampWaitlistRows);
  }

  async enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment> {
    try {
      return await withOrg(this.pool, actor.userId, actor.orgId, db => enrolInTransaction(db, actor, request, rule));
    } catch (error) {
      throw translateEnrolmentWriteError(error);
    }
  }

  camperNameOf(userId: string, orgId: string, camperId: string): Promise<string | null> {
    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<{ name: string }>(
        "SELECT trim(given_name || ' ' || family_name) AS name FROM people WHERE id = $1",
        [camperId],
      );

      return rows[0] ? rows[0].name : null;
    });
  }

  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment> {
    return withOrg(this.pool, actor.userId, actor.orgId, db => cancelInTransaction(db, actor, enrolmentId, note));
  }

  assignedClassIds(userId: string, orgId: string, teacherId: string): Promise<string[]> {
    return withOrg(this.pool, userId, orgId, async db => {
      if (!isUuid(teacherId)) {
        return [];
      }
      // A teacher's classes are the classes its linked person (people.user_id) is an instructor of (migration 0051). The join
      // checks the role too, so a person who stopped being a teacher has no classes.
      const { rows } = await db.query<{ session_id: string }>(
        `SELECT si.session_id
           FROM people p
           JOIN org_members m ON m.org_id = p.org_id AND m.user_id = p.user_id AND m.role = 'teacher'
           JOIN session_instructors si ON si.org_id = p.org_id AND si.person_id = p.id
          WHERE p.user_id = $1`,
        [teacherId],
      );

      return rows.map(r => r.session_id);
    });
  }

  camperIdsIn(userId: string, orgId: string, classIds: readonly string[]): Promise<string[]> {
    const ids = classIds.filter(isUuid);
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return withOrg(this.pool, userId, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        `SELECT DISTINCT person_id FROM enrolments WHERE session_id = ANY($1::uuid[]) AND status = 'enrolled'`,
        [ids],
      );

      return rows.map(r => r.person_id);
    });
  }
}
