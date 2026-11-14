/** Everything the system records in the audit log. Adding an entry here is how a new auditable action is introduced. */
export const AUDIT_ACTIONS = [
  'org.create', 'org.update',
  'person.create', 'person.update', 'person.archive',
  'household.create', 'household.update',
  'membership.create', 'membership.revoke',
  'credential.issue', 'credential.revoke',
  'attendance.check_in', 'attendance.check_out', 'attendance.override',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
