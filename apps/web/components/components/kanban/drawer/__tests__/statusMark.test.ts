import { describe, expect, it } from 'vitest';
import { statusMark } from '../statusMark';

const col = (name: string, kind: 'open' | 'active' | 'done') => ({ id: name, name, kind });

describe('statusMark', () => {
  it('gives each seeded status its own icon and colour: backlog clock pink, to do send blue, in progress dashed clock orange, in review search purple, done check green', () => {
    expect(statusMark(col('Backlog', 'open'))).toEqual({ glyph: 'clock', colour: 'pink' });
    expect(statusMark(col('To Do', 'open'))).toEqual({ glyph: 'send', colour: 'blue' });
    expect(statusMark(col('In Progress', 'active'))).toEqual({ glyph: 'dashed-clock', colour: 'orange' });
    expect(statusMark(col('In Review', 'active'))).toEqual({ glyph: 'search', colour: 'purple' });
    expect(statusMark(col('Done', 'done'))).toEqual({ glyph: 'circle-check', colour: 'green' });
  });
  it('matches the name regardless of case and surrounding space', () => {
    expect(statusMark(col('  in progress ', 'active')).colour).toBe('orange');
  });
  it('falls back to the colour of the kind for a column the owner named: open blue, active orange, done green', () => {
    expect(statusMark(col('Waiting on camp', 'open')).colour).toBe('blue');
    expect(statusMark(col('Writing', 'active')).colour).toBe('orange');
    expect(statusMark(col('Shipped', 'done')).colour).toBe('green');
  });
});
