import { can, type Action, type AuditAction, type Role } from '@buxa/domain';
import { ROUTES, sessionPath } from '@buxa/shared/config/routes';
import { NOTIFICATION_LIMIT, type NotificationKind } from '@buxa/shared/notifications/notifications';

export type { NotificationKind };
export { NOTIFICATION_LIMIT };

/** One audit action that notifies people: who may see it (a permission), whether the class's teachers also see it, and the copy. */
export interface NotifyRule {
  kind: NotificationKind;
  permission: Action;
  /** A teacher assigned to the class sees it even without the permission (class events only). */
  assignedTeachers: boolean;
  title: string;
  link: (entityId: string) => string;
}

const toList = (): string => ROUTES.sessions;
const toClass = (): string => ROUTES.sessions;
const toSession = (sessionId: string): string => sessionPath(sessionId);

/**
 * The audit actions that notify, and whom. Each rule is decided by the permission matrix (packages/domain), so the recipients
 * match what the people can do. A new notifying event is added here, and nowhere else.
 */
export const NOTIFY_RULES: Partial<Record<AuditAction, NotifyRule>> = {
  'registration.submit': {
    kind: 'registration',
    permission: 'registration:read',
    assignedTeachers: false,
    title: 'New registration',
    link: () => ROUTES.registration,
  },
  'session.create': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: false,
    title: 'Session added',
    link: toSession,
  },
  'session.update': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: false,
    title: 'Session changed',
    link: toSession,
  },
  'session.delete': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: false,
    title: 'Session deleted',
    link: toList,
  },
  'class.create': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: true,
    title: 'Class added',
    link: toClass,
  },
  'class.update': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: true,
    title: 'Class changed',
    link: toClass,
  },
  'class.delete': {
    kind: 'schedule',
    permission: 'classes:manage',
    assignedTeachers: true,
    title: 'Class deleted',
    link: toList,
  },
  'person.create': {
    kind: 'people',
    permission: 'people:read',
    assignedTeachers: false,
    title: 'Person added',
    link: () => ROUTES.people,
  },
  'person.archive': {
    kind: 'people',
    permission: 'people:read',
    assignedTeachers: false,
    title: 'Person removed',
    link: () => ROUTES.people,
  },
};

/** A camp member as the rules see them: who they are and what role they hold. */
export interface MemberRole {
  userId: string;
  role: Role;
}

/**
 * The people who get this notification: every member whose role may take the rule's permission, plus the rule's assigned teachers
 * (when it has them). The person who did the thing is never notified of their own action. Pure: no database.
 */
export function recipientsFor(
  rule: NotifyRule,
  members: readonly MemberRole[],
  actorUserId: string | null,
  assignedTeacherIds: ReadonlySet<string>,
  orgId: string,
): string[] {
  return members
    .filter(member => member.userId !== actorUserId)
    .filter(
      member =>
        can({ userId: member.userId, orgId, role: member.role }, rule.permission) ||
        (rule.assignedTeachers && assignedTeacherIds.has(member.userId)),
    )
    .map(member => member.userId);
}

/** The newest `limit` notifications, newest first. The list never shows more than NOTIFICATION_LIMIT. */
export function newestFirst<T extends { createdAt: string }>(rows: readonly T[], limit = NOTIFICATION_LIMIT): T[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
