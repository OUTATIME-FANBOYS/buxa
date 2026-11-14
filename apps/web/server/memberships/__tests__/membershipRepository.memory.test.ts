import { describe } from 'vitest';
import { createMemoryFixture } from '../../people/__tests__/memoryFixture';
import { membershipRepositoryContract } from './membershipRepository.contract';

describe('MembershipRepository in memory', () => {
  membershipRepositoryContract(createMemoryFixture);
});
