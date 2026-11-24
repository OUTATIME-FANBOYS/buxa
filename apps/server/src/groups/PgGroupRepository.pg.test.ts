import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { migrate, withOrg } from '@buxa/db';
import { auditActions, createClassFixture, uniqueSessionName } from '../classes/__tests__/pgClassFixture';
import { groupRepositoryContract } from './groupRepository.contract';
import { PgGroupRepository } from './PgGroupRepository';

const url = process.env.DATABASE_URL;

// The shared contract, on a real database: the locks in PgAssign.ts are what make the parallel-placement case hold here.
describe.skipIf(!url)('PgGroupRepository', () => {
  const pool = new pg.Pool({ connectionString: url });
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  groupRepositoryContract(async () => {
    const fx = await createClassFixture(pool);
    const repo = new PgGroupRepository(pool);

    return {
      repo,
      actor: fx.actor,
      session: async (startsOn, endsOn) =>
        (
          await fx.repo.createSession(fx.actor, {
            name: uniqueSessionName('Summer'),
            description: '',
            startsOn,
            endsOn,
          })
        ).id,
      person: async ({ dateOfBirth, roles = ['camper'] }) => {
        const id = await fx.addPerson(fx.orgA, dateOfBirth);
        await withOrg(pool, fx.actor.userId, fx.orgA, async db => {
          for (const role of roles) {
            await db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, $3)`, [
              fx.orgA,
              id,
              role,
            ]);
          }
        });

        return id;
      },
      close: () => fx.close(),
    };
  });

  it('writes each change to the audit log in the same transaction', async () => {
    const fx = await createClassFixture(pool);
    try {
      const repo = new PgGroupRepository(pool);
      const session = await fx.repo.createSession(fx.actor, {
        name: 'Audit',
        description: '',
        startsOn: '2027-07-05',
        endsOn: '2027-07-17',
      });
      const group = await repo.createGroup(fx.actor, session.id, {
        name: 'Hawks',
        capacity: 2,
        ratioCampers: null,
        ageRange: null,
      });
      const room = await repo.createRoom(fx.actor, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 });
      const personId = await fx.addPerson(fx.orgA, '2019-01-01');
      await withOrg(pool, fx.actor.userId, fx.orgA, db =>
        db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [fx.orgA, personId]),
      );
      await repo.assign(
        fx.actor,
        { sessionId: session.id, personId, role: 'camper', groupId: group.id, roomId: room.id },
        () => ({ kind: 'allow', overrode: null }),
      );

      const actions = await auditActions(pool, fx.orgA);
      expect(actions).toEqual(expect.arrayContaining(['group.create', 'room.create', 'assignment.create']));
    } finally {
      await fx.close();
    }
  });

  it('writes the unassign to the audit log with the session, person, group and room', async () => {
    const fx = await createClassFixture(pool);
    try {
      const repo = new PgGroupRepository(pool);
      const session = await fx.repo.createSession(fx.actor, {
        name: 'Unassign audit',
        description: '',
        startsOn: '2027-07-05',
        endsOn: '2027-07-17',
      });
      const group = await repo.createGroup(fx.actor, session.id, {
        name: 'Hawks',
        capacity: 2,
        ratioCampers: null,
        ageRange: null,
      });
      const room = await repo.createRoom(fx.actor, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 });
      const personId = await fx.addPerson(fx.orgA, '2019-01-01');
      await withOrg(pool, fx.actor.userId, fx.orgA, db =>
        db.query(`INSERT INTO person_roles (org_id, person_id, role) VALUES ($1, $2, 'camper')`, [fx.orgA, personId]),
      );
      await repo.assign(
        fx.actor,
        { sessionId: session.id, personId, role: 'camper', groupId: group.id, roomId: room.id },
        () => ({
          kind: 'allow',
          overrode: null,
        }),
      );

      await repo.unassign(fx.actor, { sessionId: session.id, personId });

      expect(await auditActions(pool, fx.orgA)).toContain('assignment.unassign');
      const rows = await withOrg(pool, fx.actor.userId, fx.orgA, db =>
        db.query<{ data: Record<string, string> }>(`SELECT data FROM audit_log WHERE action = 'assignment.unassign'`),
      );
      expect(rows.rows[0].data).toMatchObject({ sessionId: session.id, personId, groupId: group.id, roomId: room.id });
      // The place is free again: the same person can be placed in the session.
      await repo.assign(
        fx.actor,
        { sessionId: session.id, personId, role: 'camper', groupId: group.id, roomId: room.id },
        () => ({
          kind: 'allow',
          overrode: null,
        }),
      );
    } finally {
      await fx.close();
    }
  });

  it('refuses a second active assignment for one person in one session, in the database', async () => {
    const fx = await createClassFixture(pool);
    try {
      const session = await fx.repo.createSession(fx.actor, {
        name: 'Constraint',
        description: '',
        startsOn: '2027-07-05',
        endsOn: '2027-07-17',
      });
      const repo = new PgGroupRepository(pool);
      const group = await repo.createGroup(fx.actor, session.id, {
        name: 'Hawks',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const other = await repo.createGroup(fx.actor, session.id, {
        name: 'Owls',
        capacity: 4,
        ratioCampers: null,
        ageRange: null,
      });
      const room = await repo.createRoom(fx.actor, session.id, { name: 'Lodge 1', location: 'North', capacity: 4 });
      const personId = await fx.addPerson(fx.orgA, '2019-01-01');

      // The insert is done directly, bypassing the rules, to show the database refuses it on its own.
      const insertSecond = () =>
        withOrg(pool, fx.actor.userId, fx.orgA, async db => {
          await db.query(
            `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id) VALUES ($1, $2, $3, 'camper', $4, $5)`,
            [fx.orgA, session.id, personId, group.id, room.id],
          );
          await db.query(
            `INSERT INTO assignments (org_id, session_id, person_id, role, group_id, room_id) VALUES ($1, $2, $3, 'camper', $4, $5)`,
            [fx.orgA, session.id, personId, other.id, room.id],
          );
        });

      await expect(insertSecond()).rejects.toMatchObject({ code: '23505' });
    } finally {
      await fx.close();
    }
  });
});
