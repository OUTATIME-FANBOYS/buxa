import { describe, expect, it } from 'vitest';
import { cancelInTransaction, enrolInTransaction } from './PgEnrolmentWrites';
import { CamperNotFoundError, ClassNotFoundError, EnrolmentNotFoundError } from './errors';
import { fakeDb } from './__tests__/fakeDb';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  role: 'owner' as const,
};
const camperId = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
const rule = () => ({ kind: 'refuse' as const, reason: 'session_full' as const, seatsTaken: 0, capacity: 0 });

describe('enrolInTransaction guards and lock order', () => {
  it('refuses a malformed camper id without touching the database', async () => {
    const { client, seen } = fakeDb();
    await expect(
      enrolInTransaction(client as never, actor, { classId: sessionId, camperId: 'nope' }, rule),
    ).rejects.toBeInstanceOf(CamperNotFoundError);
    expect(seen).toHaveLength(0);
  });

  it('refuses a camper that row-level security or a missing row hides', async () => {
    const { client } = fakeDb(() => []);
    await expect(
      enrolInTransaction(client as never, actor, { classId: sessionId, camperId }, rule),
    ).rejects.toBeInstanceOf(CamperNotFoundError);
  });

  it('locks the camper row first, then the session row, before any rule runs', async () => {
    const { client, seen } = fakeDb(sql => {
      if (sql.includes('FROM people')) {
        return [{ date_of_birth: '2016-03-01' }];
      }

      return [];
    });
    await expect(
      enrolInTransaction(client as never, actor, { classId: sessionId, camperId }, rule),
    ).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(seen).toHaveLength(2);
    expect(seen[0].sql).toMatch(/FROM people[\s\S]*FOR UPDATE/);
    expect(seen[1].sql).toMatch(/FOR UPDATE OF s/);
  });

  it('refuses a malformed session id after the camper lock, and never reaches the rule', async () => {
    const { client, seen } = fakeDb(() => [{ date_of_birth: null }]);
    let called = false;
    await expect(
      enrolInTransaction(client as never, actor, { classId: 'x', camperId }, () => {
        called = true;

        return rule();
      }),
    ).rejects.toBeInstanceOf(ClassNotFoundError);
    expect(called).toBe(false);
    expect(seen).toHaveLength(1);
  });
});

describe('cancelInTransaction', () => {
  it('refuses a malformed enrolment id without a statement', async () => {
    const { client, seen } = fakeDb();
    await expect(cancelInTransaction(client as never, actor, 'nope', null)).rejects.toBeInstanceOf(
      EnrolmentNotFoundError,
    );
    expect(seen).toHaveLength(0);
  });

  it('reports not found when no live row was cancelled (already cancelled, another camp, or missing)', async () => {
    const { client, seen } = fakeDb(() => []);
    await expect(cancelInTransaction(client as never, actor, camperId, 'note')).rejects.toBeInstanceOf(
      EnrolmentNotFoundError,
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].sql).toMatch(/status <> 'cancelled'/);
  });
});
