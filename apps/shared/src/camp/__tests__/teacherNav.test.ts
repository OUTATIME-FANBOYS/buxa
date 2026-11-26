import { describe, expect, it } from 'vitest';
import { navGroupsFor } from '../navItems';

/** The teaching view: a viewer whose person is an instructor. It sees its own class screens only. */
const teaching = { role: 'viewer' as const, teaching: true };

describe('teaching view sidebar', () => {
  it('shows only Home, Sessions, My classes and On site (check-in is off by default)', () => {
    const groups = navGroupsFor(teaching);
    const labels = groups.flatMap(g => g.items.map(i => i.label));
    expect(labels).toEqual(['Home', 'Sessions', 'My classes', 'On site']);
    expect(groups.map(g => g.label)).toEqual(['', 'Operations']);
  });

  it('shows My classes only in the teaching view', () => {
    for (const role of ['owner', 'admin', 'staff', 'viewer'] as const) {
      const labels = navGroupsFor({ role, teaching: false }).flatMap(g => g.items.map(i => i.label));
      expect(labels).not.toContain('My classes');
    }
    expect(navGroupsFor(null).flatMap(g => g.items.map(i => i.label))).not.toContain('My classes');
  });

  it('keeps the staff sidebar unchanged', () => {
    const labels = navGroupsFor({ role: 'staff', teaching: false }).flatMap(g => g.items.map(i => i.label));
    expect(labels).toContain('People');
    expect(labels).toContain('Attendance');
    expect(labels).toContain('My tasks');
  });

  it('a plain viewer (not an instructor) keeps the viewer sidebar, without My classes', () => {
    const labels = navGroupsFor({ role: 'viewer', teaching: false }).flatMap(g => g.items.map(i => i.label));
    expect(labels).not.toContain('My classes');
    expect(labels).toContain('Sessions');
    expect(labels).toContain('My tasks');
  });
});
