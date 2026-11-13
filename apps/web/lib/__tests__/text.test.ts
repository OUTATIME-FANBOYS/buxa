import { describe, expect, it } from 'vitest';
import { initials } from '@/lib/text';

describe('initials', () => {
  it('takes the first letters of up to two words, uppercased', () => {
    expect(initials('Maya Chen')).toBe('MC');
    expect(initials('maya')).toBe('M');
    expect(initials('Ana Maria Lopez')).toBe('AM');
  });
  it('tolerates extra spaces between words', () => {
    expect(initials('Maya   Chen')).toBe('MC');
  });
});
