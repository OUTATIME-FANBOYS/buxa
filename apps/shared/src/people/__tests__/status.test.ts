import { describe, expect, it } from 'vitest';
import { ACCESS_LABEL, ACCESS_TONE } from '../status';

describe('access status', () => {
  it('gives every membership status words and a tone', () => {
    expect(ACCESS_LABEL.valid).toBe('Valid');
    expect(ACCESS_LABEL.none).toBe('No membership');
    expect(Object.keys(ACCESS_TONE).sort()).toEqual(Object.keys(ACCESS_LABEL).sort());
    expect(ACCESS_TONE.revoked).toBe('crit');
  });
});
