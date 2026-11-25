import { describe, expect, it } from 'vitest';
import { classAfterSessionChange, classesOfSession } from '../logChoices';

const classes = [
  { id: 'c-swim', name: 'Swim Juniors', sessionId: 's-1' },
  { id: 'c-art', name: 'Art', sessionId: 's-1' },
  { id: 'c-robot', name: 'Robotics', sessionId: 's-2' },
];

describe('classesOfSession', () => {
  it('offers every class when no session is chosen', () => {
    expect(classesOfSession(classes, '').map(c => c.id)).toEqual(['c-swim', 'c-art', 'c-robot']);
  });

  it('offers only the classes of the chosen session', () => {
    expect(classesOfSession(classes, 's-2').map(c => c.id)).toEqual(['c-robot']);
    expect(classesOfSession(classes, 's-9')).toEqual([]);
  });
});

describe('classAfterSessionChange', () => {
  it('keeps a class that is still offered under the new session', () => {
    expect(classAfterSessionChange('c-swim', classes, 's-1')).toBe('c-swim');
  });

  it('clears a class from another session', () => {
    expect(classAfterSessionChange('c-swim', classes, 's-2')).toBe('');
  });

  it('keeps any class when the session goes back to All sessions', () => {
    expect(classAfterSessionChange('c-robot', classes, '')).toBe('c-robot');
  });

  it('stays All classes when none is chosen', () => {
    expect(classAfterSessionChange('', classes, 's-2')).toBe('');
  });
});
