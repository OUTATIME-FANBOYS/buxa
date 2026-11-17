import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor, PlannedWrite } from '@buxa/domain';
import type { ClassRepository } from '../ClassRepository';
import type { ImportRepository } from './ImportRepository';

/** What a contract run needs from an adapter: its import repository, the class repository it reads names from, and an actor. */
export interface ImportFixture {
  repo: ImportRepository;
  classes: ClassRepository;
  actor: Actor;
  close(): Promise<void>;
}

/** One contract for every ImportRepository adapter. The Postgres adapter runs these same tests. */
export function importRepositoryContract(factory: () => Promise<ImportFixture>): void {
  describe('ImportRepository contract', () => {
    let fx: ImportFixture;
    beforeEach(async () => {
      fx = await factory();
    });
    afterEach(async () => {
      await fx.close();
    });

    const createClass = async (name: string): Promise<string> => {
      const cls = await fx.classes.createClass(fx.actor, {
        name, description: '', ageRange: { minAge: 6, maxAge: 14 }, capacity: 10, instructorRatio: null,
      });

      return cls.id;
    };

    const create = (classId: string, over: Partial<PlannedWrite> = {}): PlannedWrite => ({
      rowNumber: 2, kind: 'create', sessionId: null, classId, startsAt: '2027-07-05T03:00:00.000Z', endsAt: '2027-07-05T05:00:00.000Z',
      location: 'Lab 2', capacity: 10, externalKey: null, instructorNames: [], ratio: null, ...over,
    });

    const upload = { fileName: 'season.csv', rows: 1, created: 1, updated: 0, refused: 0 };

    it('creates sessions that list back with the class name, capacity and key, and nothing taken', async () => {
      const classId = await createClass('Robotics');
      await fx.repo.applyImport(fx.actor, upload, [create(classId, { externalKey: 'ROB-1' })]);
      const sessions = await fx.repo.listCampSessions(fx.actor.orgId);
      expect(sessions).toEqual([expect.objectContaining({
        classId, className: 'Robotics', startsAt: '2027-07-05T03:00:00.000Z', endsAt: '2027-07-05T05:00:00.000Z',
        location: 'Lab 2', capacity: 10, seatsTaken: 0, externalKey: 'ROB-1',
      })]);
    });

    it('updates an existing session in place: same id, new times and location', async () => {
      const classId = await createClass('Art');
      await fx.repo.applyImport(fx.actor, upload, [create(classId, { externalKey: 'ART-1' })]);
      const [before] = await fx.repo.listCampSessions(fx.actor.orgId);
      if (!before) {
        throw new Error('setup failed');
      }
      await fx.repo.applyImport(fx.actor, upload, [{
        ...create(classId, { externalKey: 'ART-1', location: 'Studio' }), kind: 'update', sessionId: before.id,
        startsAt: '2027-07-05T06:00:00.000Z', endsAt: '2027-07-05T08:00:00.000Z',
      }]);
      const after = await fx.repo.listCampSessions(fx.actor.orgId);
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ id: before.id, location: 'Studio', startsAt: '2027-07-05T06:00:00.000Z' });
    });

    it('rejects an update to a session that does not exist, and writes nothing from that file', async () => {
      const classId = await createClass('Music');
      const unknown = { ...create(classId, { externalKey: 'M-1' }), kind: 'update' as const, sessionId: randomUUID() };
      await expect(fx.repo.applyImport(fx.actor, upload, [create(classId, { externalKey: 'M-2', rowNumber: 2 }), unknown])).rejects.toThrow();
      expect(await fx.repo.listCampSessions(fx.actor.orgId)).toEqual([]);
    });

    it('lists only the actor\'s camp', async () => {
      const classId = await createClass('Robotics');
      await fx.repo.applyImport(fx.actor, upload, [create(classId)]);
      const other = { ...fx.actor, orgId: randomUUID() };
      expect(await fx.repo.listCampSessions(other.orgId)).toEqual([]);
    });
  });
}
