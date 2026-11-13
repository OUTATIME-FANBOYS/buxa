/** Everything the system records in the audit log. Adding an entry here is how a new auditable action is introduced. */
export const AUDIT_ACTIONS = ['org.create', 'org.update'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
