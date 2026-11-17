import { describe } from 'vitest';
import { createMemoryFixture } from '../../people/__tests__/memoryFixture';
import { credentialRepositoryContract } from './credentialRepository.contract';

describe('CredentialRepository in memory', () => {
  credentialRepositoryContract(createMemoryFixture);
});
