import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import type { Actor } from '@buxa/domain';
import { InMemoryClassRepository } from '../InMemoryClassRepository';
import { classRepositoryContract, type ClassContractFixture, type KnownGap } from './classRepository.contract';

const KNOWN_GAPS: KnownGap[] = ['seat-holds', 'waitlist-promotion'];

/** A fresh in-memory camp per test. Campers are aged 11 on the class day (born 1 March 2016). */
function createMemoryClassFixture(): Promise<ClassContractFixture> {
  const repo = new InMemoryClassRepository();
  const actor: Actor = { userId: randomUUID(), orgId: randomUUID(), role: 'owner' };

  return Promise.resolve({
    repo,
    actor,
    addCamper: () => {
      const id = randomUUID();
      repo.seedCamper(actor.orgId, id, 'Test camper', '2016-03-01');

      return Promise.resolve(id);
    },
    addSeatHold: () => Promise.reject(new Error('The in-memory class repository does not count seat holds yet')),
    close: () => Promise.resolve(),
  });
}

describe('ClassRepository in memory', () => {
  classRepositoryContract(createMemoryClassFixture, KNOWN_GAPS);
});
