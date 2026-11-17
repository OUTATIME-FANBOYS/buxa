import { describe, expect, it } from 'vitest';
import { createPgRepositories } from './repositories';
import { PgClassRepository } from './classes/PgClassRepository';
import { fakeDb } from './classes/__tests__/fakeDb';

describe('createPgRepositories', () => {
  it('wires the Postgres class repository for production', () => {
    const { pool } = fakeDb();
    const repos = createPgRepositories(pool);
    expect(repos.classes).toBeInstanceOf(PgClassRepository);
  });
});
