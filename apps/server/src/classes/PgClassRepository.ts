import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor } from '@buxa/domain';
import type { Class, Enrolment, NewSessionInput, Session, SessionPriceInput } from '@buxa/contracts';
import { recordAudit } from '../audit/recordAudit';
import type { CampClassSpan, ClassRecord, ClassRepository, EnrolRequest, EnrolmentRule } from './ClassRepository';
import { TeacherNotFoundError } from './errors';
import { cancelInTransaction, enrolInTransaction } from './PgEnrolmentWrites';
import {
  getClass,
  getSession,
  listClassRows,
  listEnrolmentRows,
  listSessionRows,
  requireClass,
  requireClassExists,
  requireSession,
  requireSessionExists,
} from './PgClassQueries';
import { deleteClassRow, insertClass, insertSession, setSessionPriceRow, setSessionPublicRow, updateClassRow } from './PgClassWrites';
import { translateClassWriteError } from './pgClassErrors';
import { toIso } from '../people/pgRows';

/**
 * Postgres adapter for sessions, classes and enrolments. Every call runs in withOrg (row-level security), and every write
 * writes its audit entry in the same transaction. Refusals are thrown from inside the transaction, so nothing is written for them.
 * Driver errors are translated to the domain errors in ./errors.ts (see pgClassErrors.ts) before they leave this file.
 */
export class PgClassRepository implements ClassRepository {
  constructor(private readonly pool: Pool) {}

  listSessions(orgId: string): Promise<Session[]> {
    return withOrg(this.pool, orgId, listSessionRows);
  }

  getSession(orgId: string, sessionId: string): Promise<Session | null> {
    return withOrg(this.pool, orgId, db => getSession(db, sessionId));
  }

  createSession(actor: Actor, input: NewSessionInput): Promise<Session> {
    return withOrg(this.pool, actor.orgId, async db => {
      const id = await insertSession(db, actor, input);

      return requireSession(db, id);
    });
  }

  setSessionPrice(actor: Actor, sessionId: string, price: SessionPriceInput | null): Promise<Session> {
    return withOrg(this.pool, actor.orgId, async db => {
      await setSessionPriceRow(db, actor, sessionId, price);

      return requireSession(db, sessionId);
    });
  }

  setSessionPublic(actor: Actor, sessionId: string, isPublic: boolean): Promise<Session> {
    return withOrg(this.pool, actor.orgId, async db => {
      await setSessionPublicRow(db, actor, sessionId, isPublic);

      return requireSession(db, sessionId);
    });
  }

  addClasses(actor: Actor, sessionId: string, inputs: ClassRecord[]): Promise<Class[]> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requireSessionExists(db, sessionId);
      const written: Class[] = [];
      for (const input of inputs) {
        written.push(await requireClass(db, await insertClass(db, actor, sessionId, input)));
      }

      return written;
    });
  }

  listCampClassSpans(orgId: string): Promise<CampClassSpan[]> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<{ starts_at: Date; ends_at: Date; class_name: string }>(
        'SELECT s.starts_at, s.ends_at, s.name AS class_name FROM sessions s ORDER BY s.starts_at',
      );

      return rows.map(r => ({ startsAt: toIso(r.starts_at), endsAt: toIso(r.ends_at), className: r.class_name }));
    });
  }

  listClasses(orgId: string, sessionId: string): Promise<Class[]> {
    return withOrg(this.pool, orgId, async db => {
      await requireSessionExists(db, sessionId);

      return listClassRows(db, sessionId);
    });
  }

  getClass(orgId: string, classId: string): Promise<Class | null> {
    return withOrg(this.pool, orgId, db => getClass(db, classId));
  }

  addClass(actor: Actor, sessionId: string, input: ClassRecord): Promise<Class> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requireSessionExists(db, sessionId);
      const id = await insertClass(db, actor, sessionId, input);

      return requireClass(db, id);
    });
  }

  async updateClass(actor: Actor, classId: string, input: ClassRecord): Promise<Class> {
    try {
      return await withOrg(this.pool, actor.orgId, async db => {
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
      await withOrg(this.pool, actor.orgId, async db => {
        const existing = await requireClass(db, classId);
        await deleteClassRow(db, actor, classId, existing.name);
      });
    } catch (error) {
      throw translateClassWriteError(error);
    }
  }

  listEnrolments(orgId: string, classId: string): Promise<Enrolment[]> {
    return withOrg(this.pool, orgId, async db => {
      await requireClassExists(db, classId);

      return listEnrolmentRows(db, classId);
    });
  }

  enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment> {
    return withOrg(this.pool, actor.orgId, db => enrolInTransaction(db, actor, request, rule));
  }

  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment> {
    return withOrg(this.pool, actor.orgId, db => cancelInTransaction(db, actor, enrolmentId, note));
  }

  assignedClassIds(orgId: string, userId: string): Promise<string[]> {
    return withOrg(this.pool, orgId, async db => {
      if (!isUuid(userId)) {
        return [];
      }
      // The join checks the role now, so a person who stopped being a teacher has no classes even before the trigger clears them.
      const { rows } = await db.query<{ session_id: string }>(
        `SELECT ct.session_id
           FROM class_teachers ct
           JOIN org_members m ON m.org_id = ct.org_id AND m.user_id = ct.user_id
          WHERE ct.user_id = $1 AND m.role = 'teacher'`,
        [userId],
      );

      return rows.map(r => r.session_id);
    });
  }

  camperIdsIn(orgId: string, classIds: readonly string[]): Promise<string[]> {
    const ids = classIds.filter(isUuid);
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<{ person_id: string }>(
        `SELECT DISTINCT person_id FROM enrolments WHERE session_id = ANY($1::uuid[]) AND status = 'enrolled'`,
        [ids],
      );

      return rows.map(r => r.person_id);
    });
  }

  async replaceTeachers(actor: Actor, classId: string, userIds: readonly string[]): Promise<void> {
    const unique = [...new Set(userIds)];
    try {
      await withOrg(this.pool, actor.orgId, async db => {
        await db.query('SELECT buxa_replace_class_teachers($1, $2, $3)', [actor.orgId, classId, unique]);
        await recordAudit(db, {
          actor,
          action: 'class.update',
          entity: 'class',
          entityId: classId,
          data: { teacherIds: unique },
        });
      });
    } catch (error) {
      // The function raises P0002 for a missing class and for a user who is not a teacher here; the message tells them apart.
      if (isPgError(error) && error.message.includes('Teacher not found')) {
        throw new TeacherNotFoundError();
      }
      throw translateClassWriteError(error);
    }
  }
}

function isPgError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && error.code === 'P0002';
}
