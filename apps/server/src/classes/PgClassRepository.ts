import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import type { Class, Enrolment, NewSessionInput, Session } from '@buxa/contracts';
import type { ClassRecord, ClassRepository, EnrolRequest, EnrolmentRule } from './ClassRepository';
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
import { deleteClassRow, insertClass, insertSession, updateClassRow } from './PgClassWrites';
import { translateClassWriteError } from './pgClassErrors';

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
}
