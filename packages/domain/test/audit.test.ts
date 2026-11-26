import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, type AuditAction } from '../src';

/** Every write to camp data has a named audit action. A rename or a missing name fails here, not in production. */
describe('audit action names', () => {
  it('are unique', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  it('use the entity.verb form, in lower case, with underscores only inside a word', () => {
    // One nested noun is allowed: person.emergency_contact.update is the documented name (docs/security.md).
    for (const action of AUDIT_ACTIONS) {
      expect(action, action).toMatch(/^[a-z]+(_[a-z]+)?(\.[a-z]+(_[a-z]+)?){1,2}$/);
    }
  });

  it.each<AuditAction>([
    'class.create',
    'class.update',
    'session.create',
    'session.update',
    'enrolment.create',
    'enrolment.override',
    'enrolment.cancel',
    'import.upload',
  ])('includes %s, the phase 2 write', action => {
    expect(AUDIT_ACTIONS).toContain(action);
  });

  it('keeps the names that phase 1 and the in-memory adapter already write', () => {
    expect(AUDIT_ACTIONS).toEqual(expect.arrayContaining(['person.create', 'attendance.check_in', 'enrolment.create']));
  });
});
