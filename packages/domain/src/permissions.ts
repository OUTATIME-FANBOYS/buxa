/**
 * Who may do what inside an organisation. Pure: no database, no framework, so the API and the UI share it.
 * Tenant isolation is enforced separately by row-level security; this answers "may this role do this?".
 * Rules fail closed: an unknown role, a missing context or another organisation is always a denial.
 */

import { isOrgAccess, ORG_ACCESS_KEYS, orgAccessPriority, type OrgAccess } from './roles/roles';

/** Organization access (the keys and order are in ./roles/roles.ts). There is no teacher access level: teaching is an instructor person role. */
export type Role = OrgAccess;

/** How far up the ladder a role is: viewer 0, staff 1, admin 2, owner 3. Higher may do more to people below them. */
export const rank = (r: Role): number => ORG_ACCESS_KEYS.length - 1 - orgAccessPriority(r);

/** `resource:verb`. Add actions here first; the compiler then forces a decision for each role. */
export const ACTIONS = [
  'org:read',
  'org:update',
  'org:archive',
  'org:delete',
  'org:unarchive',
  'org:transfer_ownership',
  'members:read',
  'members:read_contact',
  'members:invite',
  'members:change_role',
  'members:set_options',
  'members:remove',
  'members:rename',
  'members:leave',
  'audit:read',
  'data:export',
  'data:erase',
  'people:read',
  'people:read_contact',
  'people:create',
  'people:update',
  'people:delete',
  'people:authorise_pickup',
  'memberships:manage',
  'credentials:manage',
  'attendance:read',
  'attendance:record',
  'attendance:override',
  'attendance:export',
  'events:read',
  'events:create',
  'events:update',
  'events:update_details',
  'events:delete',
  'classes:manage',
  'classes:delete_with_classes',
  'classes:publish',
  'holds:manage',
  'tasks:read',
  'tasks:create',
  'tasks:update',
  'tasks:move',
  'tasks:comment',
  'tasks:delete',
  'tasks:manage_board',
  'registration:read',
  'registration:submit',
  'registration:manage',
  'registration:confirm',
  'registration:delete',
] as const;
export type Action = (typeof ACTIONS)[number];

const VIEWER: Action[] = ['org:read', 'members:read', 'people:read', 'events:read', 'tasks:read', 'members:leave'];
const STAFF: Action[] = [
  ...VIEWER,
  'people:read_contact',
  'people:create',
  'people:update',
  'attendance:read',
  'attendance:record',
  'classes:manage',
  'events:create',
  'events:update',
  'events:delete',
  'holds:manage',
  'tasks:create',
  'tasks:update',
  'tasks:move',
  'tasks:comment',
  'registration:read',
  'registration:submit',
  'registration:confirm',
  // Staff may invite people to the camp. An invite is always for viewer access plus the instructor role (see docs/ROLES.md).
  'members:invite',
];
const ADMIN: Action[] = [
  ...STAFF,
  'classes:delete_with_classes',
  'classes:publish',
  'org:update',
  'org:archive',
  'org:unarchive',
  'data:export',
  'members:read_contact',
  'members:invite',
  'members:change_role',
  'members:remove',
  'members:rename',
  'members:set_options',
  'audit:read',
  'people:delete',
  'people:authorise_pickup',
  'memberships:manage',
  'credentials:manage',
  'attendance:override',
  'attendance:export',
  'events:create',
  'events:update',
  'events:update_details',
  'events:delete',
  'tasks:delete',
  'tasks:manage_board',
  'registration:manage',
  'registration:delete',
];
const OWNER: Action[] = [...ADMIN, 'org:delete', 'org:transfer_ownership', 'data:erase'];
/**
 * The restricted view of a viewer whose person holds the instructor role (the teaching view). It is the grant set of the retired
 * teacher level, unchanged, so a teacher-era login keeps exactly what it had. It is narrower than viewer, and it never includes a
 * staff or admin right: teaching gives no more power than this list.
 */
const INSTRUCTOR_VIEW: Action[] = [
  'org:read',
  'members:leave',
  'events:read',
  'events:update_details',
  'people:read',
  'attendance:read',
];

/** What each organization access level may attempt. Rules below can still deny an action the role has. */
export const GRANTS: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(VIEWER),
  staff: new Set(STAFF),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
};

/**
 * Assigned-classes scope. In the teaching view (a viewer who is an instructor) these actions apply only to a class the person is
 * assigned to. The caller works out whether the class (or the person's class, or the sessions in a list) is one of theirs and passes
 * `assignedToClass: true`; without it the person is refused with `not_assigned`. Other access levels are not affected.
 */
const ASSIGNED_CLASSES_ONLY: ReadonlySet<Action> = new Set([
  'events:read',
  'events:update',
  'events:update_details',
  'people:read',
  'attendance:read',
  'attendance:record',
]);

/**
 * Per-person options an admin turns on for an instructor in the teaching view (off by default). An option grants only the one action
 * it names; it is still inside the assigned-classes scope above. Stored per person in `member_options` (migration 0030). The stored
 * key keeps its old name, so existing rows still match.
 */
export const MEMBER_OPTIONS = ['teacher.check_in_out'] as const;
export type MemberOption = (typeof MEMBER_OPTIONS)[number];
export const OPTION_ACTION: Record<MemberOption, Action> = { 'teacher.check_in_out': 'attendance:record' };

/** The fields a teacher may change on a class it is assigned to. Every other class field needs classes:manage. */
export const TEACHER_CLASS_FIELDS = ['name', 'description'] as const;

export interface Actor {
  userId: string;
  orgId: string;
  role: Role;
  /** True when this user's person holds the instructor role. With viewer access that gives the teaching view (see `isTeachingView`). */
  instructor?: boolean;
  /** True for an archived camp. Such a camp is read-only: only reads and the owner's delete are allowed. */
  archived?: boolean;
  /** Options turned on for this person in this camp. Only the teaching view's options count (see `MEMBER_OPTIONS`). */
  options?: readonly MemberOption[];
}

/**
 * The teaching view: a viewer whose person is an instructor. It sees only the classes it is assigned to, and holds the grants in
 * INSTRUCTOR_VIEW. Staff and admin instructors are not in this view: they keep their staff or admin grants in full.
 */
export const isTeachingView = (actor: Pick<Actor, 'role' | 'instructor'>): boolean =>
  actor.role === 'viewer' && actor.instructor === true;

/** The grants an actor holds: the teaching view's list for an instructor viewer, otherwise the access level's own list. */
const INSTRUCTOR_VIEW_GRANTS: ReadonlySet<Action> = new Set(INSTRUCTOR_VIEW);
export const grantsOf = (actor: Pick<Actor, 'role' | 'instructor'>): ReadonlySet<Action> =>
  isTeachingView(actor) ? INSTRUCTOR_VIEW_GRANTS : GRANTS[actor.role];

/** What may still be done in an archived camp: reading it, and the owner deleting it or unarchiving it. Everything else is refused. */
const readOnlyWhileArchived = (action: Action): boolean =>
  action.endsWith(':read') ||
  action.endsWith(':read_contact') ||
  action === 'attendance:export' ||
  action === 'org:delete' ||
  action === 'org:unarchive';

/** Context for the action. Member actions need `target`; role changes and invites need `newRole`. */
export interface Resource {
  orgId?: string;
  target?: { userId: string; role: Role; instructor?: boolean };
  newRole?: Role;
  /** Owners in the org right now, including the actor if they are one. */
  ownerCount?: number;
  /** Teachers only: true when the class (or the person's or the list's class) is one the teacher is assigned to. */
  assignedToClass?: boolean;
  /** members:set_options only: the option being set on the target. */
  option?: MemberOption;
}

export type Reason =
  | 'not_assigned'
  | 'role_not_allowed'
  | 'other_org'
  | 'missing_context'
  | 'not_above_target'
  | 'cannot_grant_above_self'
  | 'self_change'
  | 'last_owner'
  | 'unknown_role'
  | 'archived_camp'
  | 'option_not_for_role';
export type Decision = { allow: true } | { allow: false; reason: Reason };
const ok: Decision = { allow: true };
const no = (reason: Reason): Decision => ({ allow: false, reason });

export function authorize(actor: Actor, action: Action, res: Resource = {}): Decision {
  if (!isOrgAccess(actor.role)) {
    return no('unknown_role');
  }
  if (res.orgId !== undefined && res.orgId !== actor.orgId) {
    return no('other_org');
  }
  if (actor.archived && !readOnlyWhileArchived(action)) {
    return no('archived_camp');
  }
  // An option adds exactly the action it names, and only in the teaching view. It never widens any other access level.
  const teaching = isTeachingView(actor);
  const viaOption = teaching && (actor.options ?? []).some(o => OPTION_ACTION[o] === action);
  if (!grantsOf(actor).has(action) && !viaOption) {
    return no('role_not_allowed');
  }
  if (teaching && ASSIGNED_CLASSES_ONLY.has(action) && res.assignedToClass !== true) {
    return no('not_assigned');
  }

  const mine = rank(actor.role);
  // An owner may manage anyone; anyone else only people strictly below them.
  const above = (target: Role) => actor.role === 'owner' || mine > rank(target);

  switch (action) {
    case 'members:invite': {
      if (!res.newRole) {
        return no('missing_context');
      }

      return rank(res.newRole) <= mine ? ok : no('cannot_grant_above_self');
    }
    case 'members:change_role': {
      if (!res.target || !res.newRole) {
        return no('missing_context');
      }
      if (res.target.userId === actor.userId) {
        return no('self_change');
      }
      if (!above(res.target.role)) {
        return no('not_above_target');
      }

      return rank(res.newRole) <= mine ? ok : no('cannot_grant_above_self');
    }
    case 'members:remove': {
      if (!res.target) {
        return no('missing_context');
      }
      if (res.target.userId === actor.userId) {
        return no('self_change');
      } // leaving uses members:leave

      return above(res.target.role) ? ok : no('not_above_target');
    }
    case 'members:rename': {
      if (!res.target) {
        return no('missing_context');
      }
      if (res.target.userId === actor.userId) {
        return no('self_change');
      } // your own name is saved from your profile

      return above(res.target.role) ? ok : no('not_above_target');
    }
    case 'members:set_options': {
      if (!res.target || !res.option) {
        return no('missing_context');
      }
      if (res.target.userId === actor.userId) {
        return no('self_change');
      }
      if (res.target.role !== 'viewer' || res.target.instructor !== true) {
        return no('option_not_for_role');
      }

      return above(res.target.role) ? ok : no('not_above_target');
    }
    case 'members:leave': {
      if (actor.role !== 'owner') {
        return ok;
      }
      if (res.ownerCount === undefined) {
        return no('missing_context');
      }

      return res.ownerCount > 1 ? ok : no('last_owner');
    }
    case 'org:transfer_ownership': {
      if (!res.target) {
        return no('missing_context');
      }

      return res.target.userId === actor.userId ? no('self_change') : ok;
    }
    default:
      return ok;
  }
}

export const can = (actor: Actor, action: Action, res?: Resource): boolean => authorize(actor, action, res).allow;
