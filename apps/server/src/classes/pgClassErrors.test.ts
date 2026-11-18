import { describe, expect, it } from 'vitest';
import { SessionFullError } from './errors';
import { CAPACITY_CONSTRAINT, translateCapacityError } from './pgClassErrors';

describe('translateCapacityError', () => {
  it('turns the capacity trigger into a SessionFullError carrying the capacity', () => {
    const pgError = Object.assign(new Error('session is full'), { code: '23514', constraint: CAPACITY_CONSTRAINT });
    const translated = translateCapacityError(pgError, 4);
    expect(translated).toBeInstanceOf(SessionFullError);
    expect(translated).toMatchObject({
      kind: 'session-full',
      refusal: { kind: 'refuse', reason: 'session_full', capacity: 4 },
    });
  });

  it('leaves other check violations alone, so they are not reported as a full session', () => {
    const other = Object.assign(new Error('bad ratio'), { code: '23514', constraint: 'sessions_capacity_floor' });
    expect(translateCapacityError(other, 4)).toBe(other);
  });

  it('leaves other codes with the same constraint name alone', () => {
    const unique = Object.assign(new Error('dup'), { code: '23505', constraint: CAPACITY_CONSTRAINT });
    expect(translateCapacityError(unique, 4)).toBe(unique);
  });

  it('leaves errors that are not database errors alone', () => {
    const plain = new Error('network down');
    expect(translateCapacityError(plain, 4)).toBe(plain);
    expect(translateCapacityError('text', 4)).toBe('text');
    expect(translateCapacityError(null, 4)).toBe(null);
  });
});
