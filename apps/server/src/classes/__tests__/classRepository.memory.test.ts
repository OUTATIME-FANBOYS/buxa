import { randomUUID } from 'node:crypto';
import { describe } from 'vitest';
import { settle, type Actor } from '@buxa/domain';
import { InMemoryClassRepository } from '../InMemoryClassRepository';
import { classRepositoryContract, type ClassContractFixture } from './classRepository.contract';

/** A fresh in-memory camp per test. Campers are aged 11 on the class day (born 1 March 2016). */
function createMemoryClassFixture(): Promise<ClassContractFixture> {
  const repo = new InMemoryClassRepository();
  const actor: Actor = { userId: randomUUID(), orgId: randomUUID(), role: 'owner' };

  return Promise.resolve({
    repo,
    actor,
    addCamper: familyName => {
      const id = randomUUID();
      repo.seedCamper(actor.orgId, id, 'Test camper', '2016-03-01');
      if (familyName) {
        repo.seedHouseholdMember(id, familyName);
      }

      return Promise.resolve(id);
    },
    addSeatHold: (classId, hold) => settle(() => repo.seedSeatHold(classId, hold)),
    close: () => Promise.resolve(),
  });
}

describe('ClassRepository in memory', () => {
  classRepositoryContract(createMemoryClassFixture);
});
