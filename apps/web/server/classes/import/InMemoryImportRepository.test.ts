import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Actor, ExistingSession, PlannedWrite } from '@buxa/domain';
import { InMemoryClassRepository } from '../InMemoryClassRepository';
import { InMemoryImportRepository } from './InMemoryImportRepository';
import { importRepositoryContract } from './importRepository.contract';

const ORG = '11111111-1111-4111-8111-111111111111';
const actor: Actor = { userId: 'user-admin', orgId: ORG, role: 'admin' };
const upload = { fileName: 'season.csv', rows: 2, created: 2, updated: 0, refused: 0 };

importRepositoryContract(async () => {
  const classes = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const repo = new InMemoryImportRepository(classes);
  return { repo, classes, actor, close: async () => {} };
});

/** A class, created through the class repository so the import can read its name. */
async function setupClass(classes: InMemoryClassRepository, name: string): Promise<string> {
  return (await classes.createClass(actor, { name, description: '', ageRange: { minAge: 6, maxAge: 14 }, capacity: 10, instructorRatio: null })).id;
}

const create = (classId: string, rowNumber: number, startsAt: string, endsAt: string, externalKey: string | null = null): PlannedWrite => ({
  rowNumber, kind: 'create', sessionId: null, classId, startsAt, endsAt, location: 'Lab 2', capacity: 10, externalKey, instructorNames: [], ratio: null,
});

describe('InMemoryImportRepository: atomic confirm', () => {
  it('saves nothing when the Nth write fails: no new sessions and no audit entries', async () => {
    const classes = new InMemoryClassRepository();
    const classId = await setupClass(classes, 'Robotics');
    const repo = new InMemoryImportRepository(classes, { failOnWrite: 3 });
    const writes = [
      create(classId, 2, '2027-07-05T03:00:00.000Z', '2027-07-05T05:00:00.000Z'),
      create(classId, 3, '2027-07-05T06:00:00.000Z', '2027-07-05T08:00:00.000Z'),
      create(classId, 4, '2027-07-05T09:00:00.000Z', '2027-07-05T11:00:00.000Z'),
    ];
    await expect(repo.applyImport(actor, upload, writes)).rejects.toThrow('Injected failure on write 3');
    expect(await repo.listCampSessions(ORG)).toEqual([]);
    expect(repo.audit).toEqual([]);
  });

  it('a failure on an update leaves the earlier creates and the existing session untouched', async () => {
    const classes = new InMemoryClassRepository();
    const classId = await setupClass(classes, 'Robotics');
    const repo = new InMemoryImportRepository(classes);
    const existing: ExistingSession = {
      id: randomUUID(), classId, className: 'Robotics', startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z',
      location: 'Lab 1', capacity: 2, seatsTaken: 0, externalKey: 'OLD',
    };
    repo.seedSession(ORG, existing);
    const badUpdate: PlannedWrite = { ...create(classId, 3, '2027-07-05T06:00:00.000Z', '2027-07-05T08:00:00.000Z', 'OLD'), kind: 'update', sessionId: randomUUID() };
    await expect(repo.applyImport(actor, upload, [create(classId, 2, '2027-07-05T10:00:00.000Z', '2027-07-05T11:00:00.000Z'), badUpdate])).rejects.toThrow();
    expect(await repo.listCampSessions(ORG)).toEqual([existing]);
    expect(repo.audit).toEqual([]);
  });

  it('on success writes one upload entry, then one entry per saved session, in the same call', async () => {
    const classes = new InMemoryClassRepository();
    const classId = await setupClass(classes, 'Robotics');
    const repo = new InMemoryImportRepository(classes);
    await repo.applyImport(actor, upload, [
      create(classId, 2, '2027-07-05T03:00:00.000Z', '2027-07-05T05:00:00.000Z', 'A'),
      create(classId, 3, '2027-07-05T06:00:00.000Z', '2027-07-05T08:00:00.000Z'),
    ]);
    expect(repo.audit.map(a => a.action)).toEqual(['import.upload', 'session.create', 'session.create']);
    expect(repo.audit[0]).toMatchObject({ actorId: 'user-admin', data: { fileName: 'season.csv', rows: 2, created: 2, updated: 0, refused: 0 } });
    expect(repo.audit[1]?.data).toMatchObject({ externalKey: 'A', importFile: 'season.csv' });
  });

  it('an update is audited as session.update, and an empty plan still records the upload', async () => {
    const classes = new InMemoryClassRepository();
    const classId = await setupClass(classes, 'Robotics');
    const repo = new InMemoryImportRepository(classes);
    await repo.applyImport(actor, upload, [create(classId, 2, '2027-07-05T03:00:00.000Z', '2027-07-05T05:00:00.000Z', 'A')]);
    const [session] = await repo.listCampSessions(ORG);
    await repo.applyImport(actor, { ...upload, created: 0, updated: 1 }, [{ ...create(classId, 2, '2027-07-05T06:00:00.000Z', '2027-07-05T08:00:00.000Z', 'A'), kind: 'update', sessionId: session?.id ?? null }]);
    expect(repo.audit.map(a => a.action)).toEqual(['import.upload', 'session.create', 'import.upload', 'session.update']);

    await repo.applyImport(actor, { ...upload, refused: 2, created: 0 }, []);
    expect(repo.audit.at(-1)).toMatchObject({ action: 'import.upload', data: { refused: 2 } });
  });

  it('an empty plan does not reach the injected failure, because there is no write to fail', async () => {
    const repo = new InMemoryImportRepository(new InMemoryClassRepository(), { failOnWrite: 1 });
    await expect(repo.applyImport(actor, upload, [])).resolves.toBeUndefined();
  });
});
