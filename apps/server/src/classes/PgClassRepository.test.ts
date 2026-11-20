import { describe, expect, it } from 'vitest';
import { PgClassRepository } from './PgClassRepository';
import { CamperNotFoundError } from './errors';
import { fakeDb } from './__tests__/fakeDb';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'owner' as const,
};
const classId = '55555555-5555-4555-8555-555555555555';

describe('PgClassRepository', () => {
  it('runs every read as the request role inside a transaction fixed to the organisation', async () => {
    const { pool, seen } = fakeDb();
    const repo = new PgClassRepository(pool);
    expect(await repo.listSessions(actor.userId, actor.orgId)).toEqual([]);
    const sqls = seen.map(s => s.sql);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls).toContain('SET LOCAL ROLE buxa_app');
    expect(seen.filter(s => s.sql.startsWith('SELECT set_config')).map(s => s.params)).toEqual([
      [actor.userId],
      [actor.orgId],
    ]);
    expect(sqls.at(-1)).toBe('COMMIT');
  });

  it('refuses a malformed organisation id before it opens a connection', async () => {
    const { pool, seen } = fakeDb();
    await expect(
      new PgClassRepository(pool).listSessions('00000000-0000-4000-8000-000000000001', 'not-a-uuid'),
    ).rejects.toThrow('Invalid organisation id');
    expect(seen).toHaveLength(0);
  });

  it('rolls the transaction back when an enrolment is refused, so nothing is written', async () => {
    const { pool, seen } = fakeDb();
    const repo = new PgClassRepository(pool);
    await expect(
      repo.enrol(actor, { classId, camperId: 'not-a-uuid' }, () => {
        throw new Error('the rule must not run for a malformed camper');
      }),
    ).rejects.toBeInstanceOf(CamperNotFoundError);
    const sqls = seen.map(s => s.sql);
    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
    expect(sqls.some(s => s.startsWith('INSERT'))).toBe(false);
  });
});
