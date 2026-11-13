import { describe, expect, it } from 'vitest';
import { failure, fieldError, idle, success } from './state';

describe('ActionState', () => {
  it('has three explicit states', () => {
    expect(idle).toEqual({ status: 'idle' });
    expect(success('Saved')).toEqual({ status: 'success', message: 'Saved' });
    expect(failure('No', { name: 'Required' })).toEqual({ status: 'error', message: 'No', fieldErrors: { name: 'Required' } });
  });
  it('reads a field error only from an error state', () => {
    expect(fieldError(failure('No', { name: 'Required' }), 'name')).toBe('Required');
    expect(fieldError(failure('No'), 'name')).toBeUndefined();
    expect(fieldError(idle, 'name')).toBeUndefined();
    expect(fieldError(success(), 'name')).toBeUndefined();
  });
});
