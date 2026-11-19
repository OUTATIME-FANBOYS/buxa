import { describe, expect, it } from 'vitest';
import { navGroupsFor } from '../navItems';

describe('teacher sidebar', () => {
  it('shows only Home, Sessions, Check-in and On site', () => {
    const groups = navGroupsFor('teacher');
    const labels = groups.flatMap(g => g.items.map(i => i.label));
    expect(labels).toEqual(['Home', 'Sessions', 'Check-in', 'On site']);
    expect(groups.map(g => g.label)).toEqual(['', 'Operations']);
  });

  it('keeps the staff sidebar unchanged', () => {
    const labels = navGroupsFor('staff').flatMap(g => g.items.map(i => i.label));
    expect(labels).toContain('People');
    expect(labels).toContain('Attendance');
    expect(labels).toContain('My tasks');
  });
});
