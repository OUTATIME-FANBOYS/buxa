import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from '@buxa/db';
import type { PlannedWrite } from '@buxa/domain';
import { auditActions, createClassFixture, makeSession, type ClassFixture } from '../__tests__/pgClassFixture';
import { importRepositoryContract } from './importRepository.contract';
import { PgImportRepository } from './PgImportRepository';

const url = process.env.DATABASE_URL;

const upload = (fileName: string, rows: number) => ({ fileName, rows, created: rows, updated: 0, refused: 0 });

const create = (classId: string, over: Partial<PlannedWrite> = {}): PlannedWrite => ({
  rowNumber: 2,
  kind: 'create',
  sessionId: null,
  classId,
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  startsAt: '2027-07-05T03:00:00.000Z',
  endsAt: '2027-07-05T05:00:00.000Z',
  location: 'Lab 2',
  capacity: 10,
  externalKey: null,
  instructorNames: [],
  ratio: null,
  ...over,
});

describe.skipIf(!url)('PgImportRepository', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  // The same contract the in-memory adapter passes.
  importRepositoryContract(async () => {
    const fx = await createClassFixture(pool);

    return {
      repo: new PgImportRepository(pool),
      classes: fx.repo,
      actor: fx.actor,
      close: () => fx.close(),
    };
  });

  describe('bulk import on Postgres', () => {
    let fx: ClassFixture;
    let repo: PgImportRepository;

    const setUp = async () => {
      fx = await createClassFixture(pool);
      repo = new PgImportRepository(pool);
    };

    it('writes a whole file: every session with its audit entry, and one upload entry, in the same transaction', async () => {
      await setUp();
      try {
        const robotics = await makeSession(fx.repo, fx.actor, { name: 'Robotics' });
        const art = await makeSession(fx.repo, fx.actor, { name: 'Art' });

        await repo.applyImport(fx.actor, upload('season.csv', 2), [
          create(robotics.id, { externalKey: 'ROB-1' }),
          create(art.id, { rowNumber: 3, externalKey: 'ART-1', location: 'Studio' }),
        ]);

        const sessions = await repo.listCampSessions(fx.actor.userId, fx.orgA);
        expect(sessions).toHaveLength(2);
        expect(sessions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              classId: robotics.id,
              className: 'Robotics',
              externalKey: 'ROB-1',
              seatsTaken: 0,
            }),
            expect.objectContaining({ classId: art.id, className: 'Art', externalKey: 'ART-1', location: 'Studio' }),
          ]),
        );

        const actions = await auditActions(pool, fx.orgA);
        // Two sessions (the date ranges) were created by the fixture helper; the import then wrote two classes (audited as
        // session.create, the import's own action), and the upload.
        expect(actions.filter(a => a === 'session.create')).toHaveLength(4);
        expect(actions.filter(a => a === 'import.upload')).toHaveLength(1);
        expect(actions.slice(-3)).toEqual(['session.create', 'session.create', 'import.upload']);
      } finally {
        await fx.close();
      }
    });

    it('rolls back the whole import when one row fails: no session and no audit entry from the file', async () => {
      await setUp();
      try {
        const robotics = await makeSession(fx.repo, fx.actor, { name: 'Robotics' });
        const before = await auditActions(pool, fx.orgA);

        const missingSession = {
          ...create(robotics.id, { rowNumber: 3 }),
          kind: 'update' as const,
          sessionId: randomUUID(),
        };
        await expect(
          repo.applyImport(fx.actor, upload('bad.csv', 2), [
            create(robotics.id, { externalKey: 'ROB-9' }),
            missingSession,
          ]),
        ).rejects.toThrow();

        expect(await repo.listCampSessions(fx.actor.userId, fx.orgA)).toEqual([]);
        expect(await auditActions(pool, fx.orgA)).toEqual(before);
      } finally {
        await fx.close();
      }
    });

    it("does not show a camp another camp's imported classes and sessions", async () => {
      await setUp();
      try {
        const robotics = await makeSession(fx.repo, fx.actor, { name: 'Robotics' });
        await repo.applyImport(fx.actor, upload('season.csv', 1), [create(robotics.id, { externalKey: 'ROB-1' })]);

        expect(await repo.listCampSessions(fx.actor.userId, fx.orgA)).toHaveLength(1);
        expect(await repo.listCampSessions(fx.otherActor.userId, fx.orgB)).toEqual([]);
        expect(await fx.repo.listSessions(fx.otherActor.userId, fx.orgB)).toEqual([]);

        // Camp B cannot write into camp A's class: the class is invisible to it, so the import refuses the row.
        await expect(
          repo.applyImport(fx.otherActor, upload('steal.csv', 1), [create(robotics.id, { externalKey: 'ROB-2' })]),
        ).rejects.toThrow();
        expect(await repo.listCampSessions(fx.otherActor.userId, fx.orgB)).toEqual([]);
      } finally {
        await fx.close();
      }
    });
  });
});
