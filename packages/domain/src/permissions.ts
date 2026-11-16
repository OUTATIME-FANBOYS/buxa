/**
 * Who may do what inside an organisation. Pure: no database, no framework, so the API and the UI share it.
 * Tenant isolation is enforced separately by row-level security; this answers "may this role do this?".
 * Rules fail closed: an unknown role, a missing context or another organisation is always a denial.
 */

export const ROLES = ['viewer', 'staff', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { viewer: 0, staff: 1, admin: 2, owner: 3 };
export const rank = (r: Role) => RANK[r];

/** `resource:verb`. Add actions here first; the compiler then forces a decision for each role. */
export const ACTIONS = [
  'org:read', 'org:update', 'org:delete', 'org:transfer_ownership',
  'members:read', 'members:invite', 'members:change_role', 'members:remove', 'members:leave',
  'audit:read',
  'data:export', 'data:erase',
  'people:read', 'people:read_contact', 'people:create', 'people:update', 'people:delete',
  'memberships:manage', 'credentials:manage',
  'attendance:read', 'attendance:record', 'attendance:override', 'attendance:export',
  'events:read', 'events:create', 'events:update', 'events:delete',
  'tasks:read', 'tasks:create', 'tasks:update', 'tasks:move', 'tasks:comment', 'tasks:delete', 'tasks:manage_board',
] as const;
export type Action = (typeof ACTIONS)[number];

const VIEWER: Action[] = ['org:read', 'members:read', 'people:read', 'attendance:read', 'events:read', 'tasks:read', 'members:leave'];
const STAFF: Action[] = [...VIEWER, 'people:read_contact', 'people:create', 'people:update', 'attendance:record', 'tasks:create', 'tasks:update', 'tasks:move', 'tasks:comment'];
const ADMIN: Action[] = [
  ...STAFF, 'org:update', 'members:invite', 'members:change_role', 'members:remove', 'audit:read',
  'people:delete', 'memberships:manage', 'credentials:manage', 'attendance:override', 'attendance:export', 'events:create', 'events:update', 'events:delete', 'tasks:delete', 'tasks:manage_board',
];
const OWNER: Action[] = [...ADMIN, 'org:delete', 'org:transfer_ownership', 'data:export', 'data:erase'];

/** What each role may attempt. Rules below can still deny an action the role has. */
export const GRANTS: Record<Role, ReadonlySet<Action>> = {
  viewer: new Set(VIEWER), staff: new Set(STAFF), admin: new Set(ADMIN), owner: new Set(OWNER),
};

export interface Actor { userId: string; orgId: string; role: Role }

/** Context for the action. Member actions need `target`; role changes and invites need `newRole`. */
export interface Resource {
  orgId?: string;
  target?: { userId: string; role: Role };
  newRole?: Role;
  /** Owners in the org right now, including the actor if they are one. */
  ownerCount?: number;
}

export type Reason = 'role_not_allowed' | 'other_org' | 'missing_context' | 'not_above_target' | 'cannot_grant_above_self' | 'self_change' | 'last_owner' | 'unknown_role';
export type Decision = { allow: true } | { allow: false; reason: Reason };
const ok: Decision = { allow: true };
const no = (reason: Reason): Decision => ({ allow: false, reason });

export function authorize(actor: Actor, action: Action, res: Resource = {}): Decision {
  if (!(actor.role in RANK)) return no('unknown_role');
  if (res.orgId !== undefined && res.orgId !== actor.orgId) return no('other_org');
  if (!GRANTS[actor.role].has(action)) return no('role_not_allowed');

  const mine = rank(actor.role);
  // An owner may manage anyone; anyone else only people strictly below them.
  const above = (target: Role) => actor.role === 'owner' || mine > rank(target);

  switch (action) {
    case 'members:invite': {
      if (!res.newRole) return no('missing_context');
      return rank(res.newRole) <= mine ? ok : no('cannot_grant_above_self');
    }
    case 'members:change_role': {
      if (!res.target || !res.newRole) return no('missing_context');
      if (res.target.userId === actor.userId) return no('self_change');
      if (!above(res.target.role)) return no('not_above_target');
      return rank(res.newRole) <= mine ? ok : no('cannot_grant_above_self');
    }
    case 'members:remove': {
      if (!res.target) return no('missing_context');
      if (res.target.userId === actor.userId) return no('self_change'); // leaving uses members:leave
      return above(res.target.role) ? ok : no('not_above_target');
    }
    case 'members:leave': {
      if (actor.role !== 'owner') return ok;
      if (res.ownerCount === undefined) return no('missing_context');
      return res.ownerCount > 1 ? ok : no('last_owner');
    }
    case 'org:transfer_ownership': {
      if (!res.target) return no('missing_context');
      return res.target.userId === actor.userId ? no('self_change') : ok;
    }
    default: return ok;
  }
}

export const can = (actor: Actor, action: Action, res?: Resource): boolean => authorize(actor, action, res).allow;
