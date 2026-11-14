import type { PoolClient } from 'pg';

/** The part of a pg client the adapters use: a pool client or a transaction both fit. */
export type Db = Pick<PoolClient, 'query'>;

/** Instants leave the adapters as ISO strings (see the repository interfaces), never as Date objects. */
export const toIso = (value: Date): string => value.toISOString();
export const nullableIso = (value: Date | null): string | null => (value === null ? null : value.toISOString());
