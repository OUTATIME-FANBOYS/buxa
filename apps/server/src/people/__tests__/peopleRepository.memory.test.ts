import { describe } from 'vitest';
import { createMemoryFixture } from './memoryFixture';
import { peopleRepositoryContract } from './peopleRepository.contract';

describe('PeopleRepository in memory', () => {
  peopleRepositoryContract(createMemoryFixture);
});
