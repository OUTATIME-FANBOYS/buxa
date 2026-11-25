import { describe, expect, it } from 'vitest';
import type { AuditAction } from '@buxa/domain';
import {
  NOTIFY_RULES,
  newestFirst,
  NOTIFICATION_LIMIT,
  recipientsFor,
  type MemberRole,
  type NotifyRule,
} from '../rules';

const ruleFor = (action: AuditAction): NotifyRule => {
  const rule = NOTIFY_RULES[action];
  if (!rule) {
    throw new Error(`no rule for ${action}`);
  }

  return rule;
};

const ORG = '11111111-1111-4111-8111-111111111111';
const members: MemberRole[] = [
  { userId: 'owner', role: 'owner' },
  { userId: 'admin', role: 'admin' },
  { userId: 'staff', role: 'staff' },
  { userId: 'teacher', role: 'viewer' },
  { userId: 'viewer', role: 'viewer' },
];
const none = new Set<string>();

describe('who receives a registration', () => {
  const rule = ruleFor('registration.submit');

  it('reaches the owner, admin and staff, who hold registration:read', () => {
    expect(rule).toBeDefined();
    const got = recipientsFor(rule, members, null, none, ORG);
    expect(got).toEqual(expect.arrayContaining(['owner', 'admin', 'staff']));
  });

  it('never reaches a viewer, and a teacher without the permission does not get it either', () => {
    const got = recipientsFor(rule, members, null, none, ORG);
    expect(got).not.toContain('viewer');
    expect(got).not.toContain('teacher');
  });

  it('is not sent back to the person who submitted it', () => {
    const got = recipientsFor(rule, members, 'staff', none, ORG);
    expect(got).not.toContain('staff');
  });
});

describe('who receives a class event', () => {
  const rule = ruleFor('class.update');

  it('reaches staff who manage classes, and not a viewer', () => {
    const got = recipientsFor(rule, members, null, none, ORG);
    expect(got).toEqual(expect.arrayContaining(['owner', 'admin', 'staff']));
    expect(got).not.toContain('viewer');
  });

  it('reaches a teacher only when they are assigned to that class', () => {
    expect(recipientsFor(rule, members, null, none, ORG)).not.toContain('teacher');
    expect(recipientsFor(rule, members, null, new Set(['teacher']), ORG)).toContain('teacher');
  });

  it('a class assignment notifies the assigned person even without the permission', () => {
    const got = recipientsFor(rule, [{ userId: 'viewer', role: 'viewer' }], null, new Set(['viewer']), ORG);
    expect(got).toEqual(['viewer']);
  });
});

describe('who receives a person added or removed', () => {
  it('reaches the people who hold people:read, which includes viewers, and not a teacher without it', () => {
    const got = recipientsFor(ruleFor('person.create'), members, null, none, ORG);
    expect(got).toEqual(expect.arrayContaining(['owner', 'admin', 'staff', 'viewer']));
    expect(got).not.toContain('teacher');
  });
});

describe('the list', () => {
  it('shows at most 50, newest first', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      createdAt: new Date(Date.UTC(2027, 6, 1, 0, i)).toISOString(),
    }));
    const shown = newestFirst(rows);
    expect(NOTIFICATION_LIMIT).toBe(50);
    expect(shown).toHaveLength(50);
    expect(shown[0]?.id).toBe('n59');
    expect(shown[49]?.id).toBe('n10');
  });
});
