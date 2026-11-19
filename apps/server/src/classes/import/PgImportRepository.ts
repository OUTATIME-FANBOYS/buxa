import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withOrg } from '@buxa/db';
import { isUuid, type Actor, type ExistingSession, type PlannedWrite } from '@buxa/domain';
import { recordAudit } from '../../audit/recordAudit';
import { systemClock, type Clock } from '../../services/clock';
import { toIso, type Db } from '../../people/pgRows';
import { getClass } from '../PgClassQueries';
import { ClassNotFoundError, SessionNotFoundError } from '../errors';
import type { ImportRepository, ImportUpload } from './ImportRepository';

export interface PgImportOptions {
  now?: Clock;
}

interface CampSessionRow {
  id: string;
  class_id: string;
  class_name: string;
  starts_at: Date;
  ends_at: Date;
  location: string;
  capacity: number;
  seats_taken: number;
  external_key: string | null;
}

/**
 * Postgres adapter for the bulk import. `applyImport` runs the whole plan in one withOrg transaction: every create and update,
 * its session audit entry, and the import.upload entry. A refusal or a driver error throws from inside the transaction, so
 * nothing from the file is saved. Row-level security limits every statement to the actor's camp.
 *
 * A created session copies its class's instructor ratio, as a session made by hand does. Instructor names and ratios on the
 * planned write are not stored, as in the in-memory adapter.
 */
export class PgImportRepository implements ImportRepository {
  private readonly now: Clock;

  constructor(
    private readonly pool: Pool,
    options: PgImportOptions = {},
  ) {
    this.now = options.now ?? systemClock;
  }

  listCampSessions(orgId: string): Promise<ExistingSession[]> {
    return withOrg(this.pool, orgId, async db => {
      const { rows } = await db.query<CampSessionRow>(
        `SELECT s.id, s.class_id, c.name AS class_name, s.starts_at, s.ends_at, s.location, s.capacity, s.external_key,
                (SELECT count(*)::int FROM enrolments e WHERE e.session_id = s.id AND e.status = 'enrolled') AS seats_taken
           FROM sessions s JOIN classes c ON c.id = s.class_id
          ORDER BY s.starts_at, s.id`,
      );

      return rows.map(r => ({
        id: r.id,
        classId: r.class_id,
        className: r.class_name,
        startsAt: toIso(r.starts_at),
        endsAt: toIso(r.ends_at),
        location: r.location,
        capacity: r.capacity,
        seatsTaken: r.seats_taken,
        externalKey: r.external_key,
      }));
    });
  }

  applyImport(actor: Actor, upload: ImportUpload, writes: readonly PlannedWrite[]): Promise<void> {
    return withOrg(this.pool, actor.orgId, async db => {
      for (const w of writes) {
        if (w.kind === 'create') {
          await createSession(db, actor, upload, w);
        } else {
          await updateSession(db, actor, upload, w);
        }
      }

      await recordAudit(db, {
        actor,
        action: 'import.upload',
        entity: 'import',
        entityId: randomUUID(),
        data: {
          fileName: upload.fileName,
          rows: upload.rows,
          created: upload.created,
          updated: upload.updated,
          refused: upload.refused,
          at: this.now().toISOString(),
        },
      });
    });
  }
}

async function createSession(db: Db, actor: Actor, upload: ImportUpload, w: PlannedWrite): Promise<void> {
  if (!(await getClass(db, w.classId))) {
    throw new ClassNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (org_id, class_id, starts_at, ends_at, location, capacity, external_key, ratio_campers, ratio_instructors)
     SELECT $1, c.id, $3::timestamptz, $4::timestamptz, $5, $6, $7, c.ratio_campers, c.ratio_instructors
       FROM classes c WHERE c.id = $2
     RETURNING id`,
    [actor.orgId, w.classId, w.startsAt, w.endsAt, w.location, w.capacity, w.externalKey],
  );
  await recordAudit(db, {
    actor,
    action: 'session.create',
    entity: 'session',
    entityId: rows[0].id,
    data: {
      classId: w.classId,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      externalKey: w.externalKey,
      importFile: upload.fileName,
    },
  });
}

async function updateSession(db: Db, actor: Actor, upload: ImportUpload, w: PlannedWrite): Promise<void> {
  if (!(await getClass(db, w.classId))) {
    throw new ClassNotFoundError();
  }
  if (w.sessionId === null || !isUuid(w.sessionId)) {
    throw new SessionNotFoundError();
  }
  const { rows } = await db.query<{ id: string }>(
    `UPDATE sessions
        SET class_id = $2, starts_at = $3::timestamptz, ends_at = $4::timestamptz, location = $5, capacity = $6, external_key = $7
      WHERE id = $1
      RETURNING id`,
    [w.sessionId, w.classId, w.startsAt, w.endsAt, w.location, w.capacity, w.externalKey],
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError();
  }
  await recordAudit(db, {
    actor,
    action: 'session.update',
    entity: 'session',
    entityId: rows[0].id,
    data: { startsAt: w.startsAt, endsAt: w.endsAt, importFile: upload.fileName },
  });
}
