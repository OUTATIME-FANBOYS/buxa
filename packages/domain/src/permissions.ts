/**
 * Who may do what inside an organisation. Pure: no database, no framework, so the API and the UI share it.
 * Tenant isolation is enforced separately by row-level security; this answers "may this role do this?".
 * Rules fail closed: an unknown role, a missing context or another organisation is always a denial.
 */

/** `teacher` runs its own classes. It sits outside the viewer-to-owner ladder: it holds some grants a viewer lacks and no tasks. */
export const ROLES = ['viewer', 'staff', 'admin', 'owner', 'teacher'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2, owner: 3, teacher: 0 };
export const rank = (r: Role) => RANK[r];

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
  // Staff may invite teachers (the invite is for the teacher role only, enforced in the service and the database).
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
const TEACHER: Action[] = [
  'org:read',
  'members:leave',
  'events:read',
  'events:update_details',
  'people:read',
  'attendance:read',
];

/** What each role may attempt. Rules below can still deny an action the role has. */
export const GRANTS: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(VIEWER),
  staff: new Set(STAFF),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
  teacher: new Set(TEACHER),
};

/**
 * Assigned-classes scope. A teacher may use these actions only on a class it is assigned to. The caller works out whether the
 * class (or the person's class, or the sessions in a list) is one of the teacher's and passes `assignedToClass: true`; without it
 * a teacher is refused with `not_assigned`. Other roles are not affected.
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
 * Per-person options an admin turns on for a teacher (off by default). An option grants only the one action it names, and only to
 * a teacher; it is still inside the assigned-classes scope above. Stored per person in `member_options` (migration 0030).
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
  /** True for an archived camp. Such a camp is read-only: only reads and the owner's delete are allowed. */
  archived?: boolean;
  /** Options turned on for this person in this camp. Only a teacher's options count (see `MEMBER_OPTIONS`). */
  options?: readonly MemberOption[];
}

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
  target?: { userId: string; role: Role };
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
  if (!(actor.role in RANK)) {
    return no('unknown_role');
  }
  if (res.orgId !== undefined && res.orgId !== actor.orgId) {
    return no('other_org');
  }
  if (actor.archived && !readOnlyWhileArchived(action)) {
    return no('archived_camp');
  }
  // An option adds exactly the action it names, and only for a teacher. It never widens any other role.
  const viaOption = actor.role === 'teacher' && (actor.options ?? []).some(o => OPTION_ACTION[o] === action);
  if (!GRANTS[actor.role].has(action) && !viaOption) {
    return no('role_not_allowed');
  }
  if (actor.role === 'teacher' && ASSIGNED_CLASSES_ONLY.has(action) && res.assignedToClass !== true) {
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
      if (res.target.role !== 'teacher') {
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
