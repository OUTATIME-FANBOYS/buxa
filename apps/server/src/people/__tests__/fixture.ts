import { createHash } from 'node:crypto';
import type { Actor } from '@buxa/domain';
import type { Repositories } from '../../repositories';
import type { NewPersonRecord } from '../PeopleRepository';

/**
 * What a contract test runs against: the repositories, two users in two different organisations, and a way to read the audit log.
 * Each adapter provides one (see pgFixture.ts and memoryFixture.ts). Every test gets a fresh fixture.
 */
export interface RepositoryFixture {
  readonly repos: Repositories;
  /** A user of the organisation under test. */
  readonly actor: Actor;
  /** A user of a different organisation, for isolation checks. */
  readonly otherActor: Actor;
  /** Audit actions written for the organisation under test, oldest first. */
  auditActions(): Promise<string[]>;
  /** Removes what the test created, where the storage allows it. */
  close(): Promise<void>;
}

export type RepositoryFactory = () => Promise<RepositoryFixture>;

export const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function samplePerson(overrides: Partial<NewPersonRecord> = {}): NewPersonRecord {
  return {
    givenName: 'Ada',
    familyName: 'Lovelace',
    preferredName: null,
    dateOfBirth: null,
    email: null,
    phone: null,
    roles: ['participant'],
    ...overrides,
  };
}

/** A 32-byte SHA-256 digest, as the badge code stores it. */
export const tokenHash = (seed: string): Buffer => createHash('sha256').update(seed).digest();

/** Resolves when `promise` rejects with an error the guard accepts; fails otherwise. */
export async function expectRejection(promise: Promise<unknown>, guard: (error: unknown) => boolean): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (guard(error)) return;
    throw error;
  }
  throw new Error('expected the call to reject');
}
