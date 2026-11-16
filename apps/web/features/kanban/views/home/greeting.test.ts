import { describe, expect, it } from 'vitest';
import { greetingFor } from './greeting';

describe('greetingFor', () => {
  it.each([
    [0, 'Good morning'], [11, 'Good morning'],
    [12, 'Good afternoon'], [17, 'Good afternoon'],
    [18, 'Good evening'], [23, 'Good evening'],
  ])('hour %i says %s', (hour, text) => {
    expect(greetingFor(hour)).toBe(text);
  });
});
