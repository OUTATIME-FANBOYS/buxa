import { describe, expect, it } from 'vitest';
import { deletedMessage, deletedSessionName, notDeletedMessage, type RefusedSession } from '../sessionDeletion';

const refused = (name: string, code = 'session_has_classes'): RefusedSession => ({
  id: `id-${name}`,
  name,
  code,
  reason: 'This session has classes. Delete them first.',
});

describe('deletedMessage', () => {
  it('says how many sessions were deleted, singular for one', () => {
    expect(deletedMessage(1)).toBe('Deleted 1 session.');
    expect(deletedMessage(2)).toBe('Deleted 2 sessions.');
  });
});

describe('notDeletedMessage', () => {
  it('is null when nothing was refused', () => {
    expect(notDeletedMessage([])).toBeNull();
  });

  it('names each refused session with its short reason', () => {
    expect(notDeletedMessage([refused('Art')])).toBe('Not deleted: Art (has classes).');
  });

  it('names at most three, then counts the rest', () => {
    const message = notDeletedMessage(['Art', 'Music', 'Drama', 'Dance', 'Chess'].map(name => refused(name)));
    expect(message).toBe('Not deleted: Art (has classes), Music (has classes), Drama (has classes) and 2 more.');
  });
});

describe('deletedSessionName', () => {
  it('returns a non-empty string, trimmed', () => {
    expect(deletedSessionName('  Summer camp ')).toBe('Summer camp');
  });

  it('ignores anything that is not a non-empty string', () => {
    expect(deletedSessionName(undefined)).toBeNull();
    expect(deletedSessionName('')).toBeNull();
    expect(deletedSessionName('   ')).toBeNull();
    expect(deletedSessionName(['Art'])).toBeNull();
    expect(deletedSessionName(7)).toBeNull();
  });
});
