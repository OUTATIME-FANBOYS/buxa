import type { Pool, PoolClient } from 'pg';
import { settle } from '@buxa/domain';

/** A statement the fake saw, and the parameters it was given. */
export interface Seen {
  sql: string;
  params: unknown[];
}

/** Answers one statement. Return the rows to hand back; undefined means no rows. */
export type Answer = (sql: string, params: unknown[]) => { id?: string; [column: string]: unknown }[] | undefined;

/**
 * A scripted client for unit tests of the Postgres adapter. It records every statement in order and answers from `answer`.
 * Unanswered statements return no rows. Used only where a real database is not needed; the *.pg.test.ts files cover the rest.
 */
export function fakeDb(answer: Answer = () => undefined) {
  const seen: Seen[] = [];
  const query = (sql: string, params: unknown[] = []) => {
    return settle(() => {
      seen.push({ sql, params });
      const rows = answer(sql, params) ?? [];

      return { rows, rowCount: rows.length };
    });
  };
  const client = { query } as unknown as Pick<PoolClient, 'query'>;
  const pool = {
    connect: () => settle(() => ({ query, release: () => undefined }) as unknown as PoolClient),
    query,
  } as unknown as Pool;

  return { client, pool, seen };
}
