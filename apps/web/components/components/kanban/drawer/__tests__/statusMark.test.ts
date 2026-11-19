import { describe, expect, it } from 'vitest';
import { statusMark } from '../statusMark';

const col = (name: string, kind: 'open' | 'active' | 'done') => ({ id: name, name, kind });

describe('statusMark', () => {
  it('gives each seeded status its own emoji and token', () => {
    expect(statusMark(col('Backlog', 'open'))).toEqual({ emoji: '📥', token: 'backlog' });
    expect(statusMark(col('To Do', 'open'))).toEqual({ emoji: '📝', token: 'todo' });
    expect(statusMark(col('In Progress', 'active'))).toEqual({ emoji: '🔨', token: 'progress' });
    expect(statusMark(col('In Review', 'active'))).toEqual({ emoji: '🔍', token: 'review' });
    expect(statusMark(col('Done', 'done'))).toEqual({ emoji: '✅', token: 'done' });
  });
  it('matches the name regardless of case and surrounding space', () => {
    expect(statusMark(col('  in progress ', 'active')).token).toBe('progress');
  });
  it('falls back to the mark for the column kind when the owner named the column something else', () => {
    expect(statusMark(col('Waiting on camp', 'open')).token).toBe('todo');
    expect(statusMark(col('Writing', 'active')).token).toBe('progress');
    expect(statusMark(col('Shipped', 'done')).token).toBe('done');
  });
});
