import { describe } from 'vitest';
import { createMemoryFixture } from '../../people/__tests__/memoryFixture';
import { attendanceRepositoryContract } from './attendanceRepository.contract';

describe('AttendanceRepository in memory', () => {
  attendanceRepositoryContract(createMemoryFixture);
});
