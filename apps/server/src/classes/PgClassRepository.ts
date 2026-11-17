import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import type { Actor } from '@buxa/domain';
import type { Class, Enrolment, NewClassInput, Session } from '@buxa/contracts';
import type { ClassRepository, EnrolRequest, EnrolmentRule, NewSessionRecord } from './ClassRepository';
import { cancelInTransaction, enrolInTransaction } from './PgEnrolmentWrites';
import { getClass, getSession, listClassRows, listEnrolmentRows, listSessionRows, requireClass, requireSessionExists } from './PgClassQueries';
import { insertClass, insertSession } from './PgClassWrites';

/**
 * Postgres adapter for classes, sessions and enrolments. Every call runs in withOrg (row-level security), and every write
 * writes its audit entry in the same transaction. Refusals are thrown from inside the transaction, so nothing is written for them.
 * Driver errors are translated to the domain errors in ./errors.ts (see pgClassErrors.ts) before they leave this file.
 */
export class PgClassRepository implements ClassRepository {
  constructor(private readonly pool: Pool) {}

  listClasses(orgId: string): Promise<Class[]> {
    return withOrg(this.pool, orgId, listClassRows);
  }

  getClass(orgId: string, classId: string): Promise<Class | null> {
    return withOrg(this.pool, orgId, db => getClass(db, classId));
  }

  createClass(actor: Actor, input: NewClassInput): Promise<Class> {
    return withOrg(this.pool, actor.orgId, async db => {
      const id = await insertClass(db, actor, input);

      return requireClass(db, id);
    });
  }

  addSession(actor: Actor, classId: string, input: NewSessionRecord): Promise<Session> {
    return withOrg(this.pool, actor.orgId, async db => {
      await requireClass(db, classId);
      const id = await insertSession(db, actor, classId, input);
      const session = await getSession(db, id);
      if (!session) {
        throw new Error('A session was written but cannot be read back');
      }

      return session;
    });
  }

  listSessions(orgId: string, classId: string): Promise<Session[]> {
    return withOrg(this.pool, orgId, async db => {
      await requireClass(db, classId);

      return listSessionRows(db, classId);
    });
  }

  listEnrolments(orgId: string, sessionId: string): Promise<Enrolment[]> {
    return withOrg(this.pool, orgId, async db => {
      await requireSessionExists(db, sessionId);

      return listEnrolmentRows(db, sessionId);
    });
  }

  enrol(actor: Actor, request: EnrolRequest, rule: EnrolmentRule): Promise<Enrolment> {
    return withOrg(this.pool, actor.orgId, db => enrolInTransaction(db, actor, request, rule));
  }

  cancelEnrolment(actor: Actor, enrolmentId: string, note: string | null): Promise<Enrolment> {
    return withOrg(this.pool, actor.orgId, db => cancelInTransaction(db, actor, enrolmentId, note));
  }
}
