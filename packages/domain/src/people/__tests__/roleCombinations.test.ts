import { describe, expect, it } from 'vitest';
import type { CampRole } from '../roles';
import { ALLOWED_ROLE_SETS, isAllowedRoleSet, isRoleAvailable } from '../roleCombinations';

describe('isAllowedRoleSet: the ten allowed sets', () => {
  it.each([
    ['Camper', ['camper']],
    ['Camper + Participant', ['camper', 'participant']],
    ['Parent or guardian', ['guardian']],
    ['Parent or guardian + Instructor', ['guardian', 'instructor']],
    ['Parent or guardian + Organizer', ['guardian', 'organizer']],
    ['Parent or guardian + Participant', ['guardian', 'participant']],
    ['Admin staff', ['admin_staff']],
    ['Instructor', ['instructor']],
    ['Organizer', ['organizer']],
    ['Participant', ['participant']],
  ] as const)('%s is allowed', (_name, roles) => {
    expect(isAllowedRoleSet([...roles])).toBe(true);
  });

  it('lists exactly the ten allowed sets', () => {
    expect(ALLOWED_ROLE_SETS).toHaveLength(10);
  });

  it('ignores order and duplicates', () => {
    expect(isAllowedRoleSet(['participant', 'camper'])).toBe(true);
    expect(isAllowedRoleSet(['participant', 'guardian', 'participant'])).toBe(true);
  });

  it.each([
    ['Camper + Instructor', ['camper', 'instructor']],
    ['Admin staff + Instructor', ['admin_staff', 'instructor']],
    ['Parent + Admin staff', ['guardian', 'admin_staff']],
    ['Parent + Instructor + Organizer (three roles)', ['guardian', 'instructor', 'organizer']],
    ['Instructor + Organizer (two staff roles)', ['instructor', 'organizer']],
    ['Instructor + Participant (two staff roles)', ['instructor', 'participant']],
    ['Organizer + Participant (two staff roles)', ['organizer', 'participant']],
    ['Camper + Organizer', ['camper', 'organizer']],
    ['Empty set', []],
  ] as const)('%s is rejected', (_name, roles) => {
    expect(isAllowedRoleSet([...roles] as CampRole[])).toBe(false);
  });
});

describe('isRoleAvailable: a box that would make a disallowed set is off', () => {
  it('with nothing chosen, every role can be ticked', () => {
    expect(isRoleAvailable([], 'instructor')).toBe(true);
    expect(isRoleAvailable([], 'admin_staff')).toBe(true);
  });

  it('a staff role blocks the other staff roles, but not a family role that fits', () => {
    expect(isRoleAvailable(['instructor'], 'organizer')).toBe(false);
    expect(isRoleAvailable(['instructor'], 'participant')).toBe(false);
    expect(isRoleAvailable(['instructor'], 'admin_staff')).toBe(false);
    expect(isRoleAvailable(['instructor'], 'camper')).toBe(false);
    expect(isRoleAvailable(['instructor'], 'guardian')).toBe(true);
  });

  it('a chosen role stays available so it can be unticked', () => {
    expect(isRoleAvailable(['instructor'], 'instructor')).toBe(true);
  });

  it('while the chosen set is not allowed (legacy), nothing is blocked', () => {
    expect(isRoleAvailable(['instructor', 'organizer'], 'camper')).toBe(true);
  });
});
