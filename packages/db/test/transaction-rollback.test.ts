import { describe, expect, it, vi, type Mock } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../src';
import { settle } from '@buxa/domain';

// Audit S-13. Fault injection with a scripted client: no database needed.
// A rollback that fails must not return the connection to the pool.

/** The test double for a pooled client: its query and release are mocks with these shapes. */
interface FakeClient {
  query: Mock<(sql: string) => Promise<{ rows: never[]; rowCount: number }>>;
  release: Mock<(err?: unknown) => void>;
}

/** A client whose statements succeed unless `fail` names them. */
function fakeClient(fail: Record<string, Error>): FakeClient {
  return {
    query: vi.fn((sql: string): Promise<{ rows: never[]; rowCount: number }> => {
      return settle(() => {
        if (fail[sql]) {
          throw fail[sql];
        }

        return { rows: [], rowCount: 0 };
      });
    }),
    release: vi.fn<(err?: unknown) => void>(),
  };
}

function poolWith(client: FakeClient): Pool {
  return { connect: vi.fn(() => settle(() => client)) } as unknown as Pool;
}

describe('transaction() when the rollback fails (S-13)', () => {
  it('destroys the connection (release with an error) instead of pooling it, and surfaces the rollback failure', async () => {
    const workError = new Error('insert failed');
    const rollbackError = new Error('connection lost');
    const client = fakeClient({ ROLLBACK: rollbackError });
    const pool = poolWith(client);

    const outcome = transaction(pool, () => {
      return settle(() => {
        throw workError;
      });
    });

    await expect(outcome).rejects.toThrow(/Rollback failed.*connection lost/);
    await expect(outcome).rejects.toMatchObject({ cause: workError });
    expect(client.release).toHaveBeenCalledTimes(1);
    const released = client.release.mock.calls[0][0];
    expect(released).toBeInstanceOf(Error);
    expect(released).toBe(rollbackError);
  });

  it('a non-Error rollback failure still destroys the connection', async () => {
    const client = fakeClient({});
    client.query.mockImplementation((sql: string) => {
      return settle(() => {
        if (sql === 'ROLLBACK') {
          throw 'socket reset';
        }

        return { rows: [], rowCount: 0 };
      });
    });
    const pool = poolWith(client);

    await expect(
      transaction(pool, () => {
        return settle(() => {
          throw new Error('boom');
        });
      }),
    ).rejects.toThrow(/socket reset/);
    expect(client.release.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('when the rollback works, the original error is rethrown unchanged and the connection is pooled', async () => {
    const workError = new Error('insert failed');
    const client = fakeClient({});
    const pool = poolWith(client);

    await expect(
      transaction(pool, () => {
        return settle(() => {
          throw workError;
        });
      }),
    ).rejects.toBe(workError);
    expect(client.release).toHaveBeenCalledWith();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('on success the result is returned and the connection is pooled', async () => {
    const client = fakeClient({});
    const pool = poolWith(client);

    await expect(
      transaction(pool, async (db: PoolClient) => {
        await db.query('SELECT 1');

        return 42;
      }),
    ).resolves.toBe(42);
    expect(client.query.mock.calls.map(c => c[0])).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(client.release).toHaveBeenCalledWith();
  });
});
