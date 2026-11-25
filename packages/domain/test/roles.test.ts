import { describe, expect, it } from 'vitest';
import {
  ORG_ACCESS,
  ORG_ACCESS_KEYS,
  PERSON_ROLES,
  PERSON_ROLE_KEYS,
  authorize,
  can,
  isAssignableToClass,
  isOrgAccess,
  isPersonRole,
  isStaffRole,
  isTeachingView,
  orgAccessLabel,
  personRoleLabel,
  primaryPersonRole,
  type Actor,
} from '../src';
import { CAMP_ROLES, CAMP_ROLE_LABELS } from '../src/people/roles';
import { ALLOWED_ROLE_SETS, STAFF_ROLE_ORDER, isRoleAvailable } from '../src/people/roleCombinations';

const ORG = 'org-1';

describe('organization access (docs/ROLES.md)', () => {
  it('lists owner, admin, staff and viewer, highest first, and nothing else', () => {
    expect([...ORG_ACCESS_KEYS]).toEqual(['owner', 'admin', 'staff', 'viewer']);
    expect(ORG_ACCESS.map(role => role.priority)).toEqual([0, 1, 2, 3]);
  });

  it('has no teacher access level', () => {
    expect(ORG_ACCESS_KEYS).not.toContain('teacher');
    expect(isOrgAccess('teacher')).toBe(false);
    expect(isOrgAccess('viewer')).toBe(true);
  });

  it('labels each level from the table, and no label says Teacher', () => {
    expect(orgAccessLabel('owner')).toBe('Owner');
    expect(orgAccessLabel('viewer')).toBe('Viewer');
    for (const role of ORG_ACCESS) {
      expect(role.label).not.toMatch(/teacher/i);
    }
  });
});

describe('person roles (docs/ROLES.md)', () => {
  it('lists the six roles in priority order, staff roles first', () => {
    expect([...PERSON_ROLE_KEYS]).toEqual([
      'admin_staff',
      'organizer',
      'instructor',
      'participant',
      'guardian',
      'camper',
    ]);
    expect(PERSON_ROLES.map(role => role.type)).toEqual(['staff', 'staff', 'staff', 'staff', 'family', 'family']);
  });

  it('gives the labels the screens show, and the camp role labels come from the same table', () => {
    expect(personRoleLabel('guardian')).toBe('Parent or guardian');
    expect(personRoleLabel('admin_staff')).toBe('Admin staff');
    expect([...CAMP_ROLES]).toEqual([...PERSON_ROLE_KEYS]);
    for (const role of PERSON_ROLE_KEYS) {
      expect(CAMP_ROLE_LABELS[role]).toBe(personRoleLabel(role));
    }
    expect(isPersonRole('instructor')).toBe(true);
    expect(isPersonRole('teacher')).toBe(false);
  });

  it('knows which roles are staff', () => {
    expect(PERSON_ROLE_KEYS.filter(isStaffRole)).toEqual(['admin_staff', 'organizer', 'instructor', 'participant']);
    expect(isStaffRole('guardian')).toBe(false);
    expect(isStaffRole('camper')).toBe(false);
  });

  it('shows a camper and a guardian as Guardian', () => {
    expect(primaryPersonRole(['camper', 'guardian'])).toBe('guardian');
  });

  it('shows an instructor and a participant as Instructor', () => {
    expect(primaryPersonRole(['participant', 'instructor'])).toBe('instructor');
  });

  it('shows an admin staff and an instructor as Admin staff', () => {
    expect(primaryPersonRole(['instructor', 'admin_staff'])).toBe('admin_staff');
  });

  it('shows a family role alone, and nothing for a person with no role', () => {
    expect(primaryPersonRole(['camper'])).toBe('camper');
    expect(primaryPersonRole([])).toBeNull();
  });

  it('a parent who also teaches shows as Instructor first, and still holds the Guardian role', () => {
    expect(primaryPersonRole(['guardian', 'instructor'])).toBe('instructor');
    expect(isRoleAvailable(['guardian'], 'instructor')).toBe(true);
  });

  it('assigns only an instructor to a class, and nothing else', () => {
    for (const role of PERSON_ROLE_KEYS) {
      expect(isAssignableToClass(role), role).toBe(role === 'instructor');
    }
  });

  it('keeps the staff hierarchy and the allowed role sets in one place', () => {
    expect([...STAFF_ROLE_ORDER]).toEqual(['admin_staff', 'organizer', 'instructor', 'participant']);
    expect(ALLOWED_ROLE_SETS.flat().every(role => PERSON_ROLE_KEYS.includes(role))).toBe(true);
  });
});

describe('the teaching view: an instructor with viewer access', () => {
  const instructor = (userId = 'teacher-1'): Actor => ({ userId, orgId: ORG, role: 'viewer', instructor: true });

  it('is the viewer access level with the instructor role, and nothing else', () => {
    expect(isTeachingView(instructor())).toBe(true);
    expect(isTeachingView({ role: 'viewer', instructor: false })).toBe(false);
    expect(isTeachingView({ role: 'staff', instructor: true })).toBe(false);
  });

  it('a teacher-era login sees only the classes it is assigned to', () => {
    expect(authorize(instructor(), 'events:read', { orgId: ORG })).toEqual({ allow: false, reason: 'not_assigned' });
    expect(can(instructor(), 'events:read', { orgId: ORG, assignedToClass: true })).toBe(true);
    expect(can(instructor(), 'people:read', { orgId: ORG, assignedToClass: true })).toBe(true);
    expect(can(instructor(), 'people:read', { orgId: ORG, assignedToClass: false })).toBe(false);
  });

  it('cannot open the team access page, settings or the audit log', () => {
    expect(can(instructor(), 'members:read', { orgId: ORG })).toBe(false);
    expect(can(instructor(), 'org:update', { orgId: ORG })).toBe(false);
    expect(can(instructor(), 'audit:read', { orgId: ORG })).toBe(false);
    expect(
      can(instructor(), 'members:change_role', {
        orgId: ORG,
        target: { userId: 'x', role: 'viewer' },
        newRole: 'viewer',
      }),
    ).toBe(false);
  });

  it('cannot invite anyone, so no invite can offer any access to the teaching view', () => {
    expect(can(instructor(), 'members:invite', { orgId: ORG, newRole: 'viewer' })).toBe(false);
  });

  it('the class picker lists instructors only, and the invite choices offer no teacher', () => {
    const choices = PERSON_ROLE_KEYS.filter(isAssignableToClass);
    expect(choices).toEqual(['instructor']);
    const inviteChoices = ORG_ACCESS.map(role => role.key);
    expect(inviteChoices).not.toContain('teacher');
  });
});
