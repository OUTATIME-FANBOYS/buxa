import { randomUUID } from 'node:crypto';
import type { Actor, ExistingSession, PlannedWrite } from '@buxa/domain';
import { systemClock, type Clock } from '../../services/clock';
import type { AuditRecord } from '../../people/InMemoryDatabase';
import { ClassNotFoundError, SessionNotFoundError } from '../errors';
import type { ClassRepository } from '../ClassRepository';
import type { ImportRepository, ImportUpload } from './ImportRepository';
import { settle } from '@buxa/domain';

export interface InMemoryImportOptions {
  now?: Clock;
  /** Test only: the Nth write of an `applyImport` call throws, so a test can check that nothing from that file is saved. */
  failOnWrite?: number;
}

/**
 * In-memory adapter for the import. An `applyImport` stages every write on a copy and replaces the stored state only when all of
 * them succeed, so a failure leaves no session and no audit entry behind. Calls run one after another (there is no concurrent
 * writer here); the database adapter gets its isolation from the transaction.
 */
export class InMemoryImportRepository implements ImportRepository {
  /** Every audit entry, in the order it was written. */
  readonly audit: AuditRecord[] = [];
  private sessions = new Map<string, ExistingSession & { orgId: string }>();

  constructor(
    private readonly classes: ClassRepository,
    private readonly options: InMemoryImportOptions = {},
  ) {}

  /** Test setup: a session that already exists in the camp. */
  seedSession(orgId: string, session: ExistingSession): void {
    this.sessions.set(session.id, { ...session, orgId });
  }

  listCampSessions(orgId: string): Promise<ExistingSession[]> {
    return settle(() => {
      return [...this.sessions.values()]
        .filter(s => s.orgId === orgId)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
        .map(s => {
          const copy: Partial<typeof s> = { ...s };
          delete copy.orgId;

          return copy as Omit<typeof s, 'orgId'>;
        });
    });
  }

  async applyImport(actor: Actor, upload: ImportUpload, writes: readonly PlannedWrite[]): Promise<void> {
    const staged = new Map(this.sessions);
    const entries: AuditRecord[] = [];
    let attempted = 0;

    for (const w of writes) {
      attempted += 1;
      if (attempted === this.options.failOnWrite) {
        throw new Error(`Injected failure on write ${attempted}`);
      }
      const cls = await this.classes.getClass(actor.orgId, w.classId);
      if (!cls) {
        throw new ClassNotFoundError();
      }

      if (w.kind === 'create') {
        const id = randomUUID();
        staged.set(id, {
          id,
          orgId: actor.orgId,
          classId: w.classId,
          className: cls.name,
          startsAt: w.startsAt,
          endsAt: w.endsAt,
          location: w.location,
          capacity: w.capacity,
          seatsTaken: 0,
          externalKey: w.externalKey,
        });
        entries.push({
          orgId: actor.orgId,
          actorId: actor.userId,
          action: 'session.create',
          entity: 'session',
          entityId: id,
          data: {
            classId: w.classId,
            startsAt: w.startsAt,
            endsAt: w.endsAt,
            externalKey: w.externalKey,
            importFile: upload.fileName,
          },
        });
      } else {
        const existing = w.sessionId === null ? undefined : staged.get(w.sessionId);
        if (!existing || existing.orgId !== actor.orgId) {
          throw new SessionNotFoundError();
        }
        staged.set(existing.id, {
          ...existing,
          classId: w.classId,
          className: cls.name,
          startsAt: w.startsAt,
          endsAt: w.endsAt,
          location: w.location,
          capacity: w.capacity,
          externalKey: w.externalKey,
        });
        entries.push({
          orgId: actor.orgId,
          actorId: actor.userId,
          action: 'session.update',
          entity: 'session',
          entityId: existing.id,
          data: { startsAt: w.startsAt, endsAt: w.endsAt, importFile: upload.fileName },
        });
      }
    }

    // Everything succeeded: publish the staged state and its audit entries together.
    const now = (this.options.now ?? systemClock)().toISOString();
    const uploadEntry: AuditRecord = {
      orgId: actor.orgId,
      actorId: actor.userId,
      action: 'import.upload',
      entity: 'import',
      entityId: randomUUID(),
      data: {
        fileName: upload.fileName,
        rows: upload.rows,
        created: upload.created,
        updated: upload.updated,
        refused: upload.refused,
        at: now,
      },
    };
    this.sessions = staged;
    this.audit.push(uploadEntry, ...entries);
  }
}
