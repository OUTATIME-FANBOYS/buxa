import { describe, expect, it } from 'vitest';
import { navGroupsFor } from '../navItems';

describe('teacher sidebar', () => {
  it('shows only Home, Sessions, My classes and On site (check-in is off by default)', () => {
    const groups = navGroupsFor('teacher');
    const labels = groups.flatMap(g => g.items.map(i => i.label));
    expect(labels).toEqual(['Home', 'Sessions', 'My classes', 'On site']);
    expect(groups.map(g => g.label)).toEqual(['', 'Operations']);
  });

  it('shows My classes to a teacher only', () => {
    for (const role of ['owner', 'admin', 'staff', 'viewer'] as const) {
      const labels = navGroupsFor(role).flatMap(g => g.items.map(i => i.label));
      expect(labels).not.toContain('My classes');
    }
    expect(navGroupsFor(null).flatMap(g => g.items.map(i => i.label))).not.toContain('My classes');
  });

  it('keeps the staff sidebar unchanged', () => {
    const labels = navGroupsFor('staff').flatMap(g => g.items.map(i => i.label));
    expect(labels).toContain('People');
    expect(labels).toContain('Attendance');
    expect(labels).toContain('My tasks');
  });
});
