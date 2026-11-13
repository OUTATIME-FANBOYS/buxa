import { describe, expect, it } from 'vitest';
import { abilitiesFor, roleAllows } from './abilities';

const allowed = (role: Parameters<typeof abilitiesFor>[0]) => abilitiesFor(role).filter(a => a.allowed).map(a => a.label);

describe('abilitiesFor (read from the same grants the server uses)', () => {
  it('viewer only looks', () => expect(allowed('viewer')).toEqual(['See who is in the camp']));
  it('staff can work but not administer', () => {
    expect(allowed('staff')).toContain('Record attendance');
    expect(allowed('staff')).not.toContain('Rename the camp');
  });
  it('admin can rename and manage access but not delete', () => {
    expect(allowed('admin')).toEqual(expect.arrayContaining(['Rename the camp', 'Manage who has access', 'Read the audit log']));
    expect(allowed('admin')).not.toContain('Delete the camp');
  });
  it('owner can do everything listed', () => expect(abilitiesFor('owner').every(a => a.allowed)).toBe(true));
  it('roleAllows agrees with the list', () => {
    expect(roleAllows('viewer', 'org:update')).toBe(false);
    expect(roleAllows('admin', 'org:update')).toBe(true);
  });
});
