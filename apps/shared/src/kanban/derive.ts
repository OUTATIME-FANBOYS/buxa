import type { Role as CampRole } from '@buxa/domain';
import type { AppState, ColumnKind, Role, Task } from './types';
import { today } from '../dates';

/**
 * The kanban's own role for each camp role. The camp role is the rule (see packages/domain permissions):
 * staff may create, update, move and comment on tasks, which is the kanban's `member`; only owners and admins manage boards.
 */
export const KANBAN_ROLE_FOR_CAMP: Record<CampRole, Role> = { owner: 'owner', admin: 'admin', staff: 'member', viewer: 'viewer' };

/**
 * Everything the screens read from the raw state: who I am, my workspace and project, and lookups. Pure, so it is testable.
 * With a camp role, that role decides what I may do and which projects I see: every camp member can read the camp's
 * projects (the matrix gives every role `tasks:read`), and the camp role replaces any kanban membership role.
 * Without one (no camp yet), the kanban's own membership decides, as before.
 */
export function deriveView(s: AppState, camp: CampRole | null = null) {
  const me = s.users.find(u => u.id === s.session.userId) ?? null;
  const myWorkspaces = camp
    ? s.workspaces
    : s.workspaces.filter(w => w.members.some(m => m.userId === me?.id));
  const workspace = myWorkspaces.find(w => w.id === s.ui.workspaceId) ?? myWorkspaces[0] ?? null;
  const projects = s.projects.filter(p => p.workspaceId === workspace?.id);
  const project = projects.find(p => p.id === s.ui.projectId) ?? projects[0] ?? null;
  const members = (workspace?.members ?? []).flatMap(m => {
    const user = s.users.find(u => u.id === m.userId);

    return user ? [{ ...m, user }] : [];
  });
  const membershipRole = workspace?.members.find(m => m.userId === me?.id)?.role ?? 'viewer';
  const myRole: Role = camp ? KANBAN_ROLE_FOR_CAMP[camp] : membershipRole;
  const kinds = new Map<string, ColumnKind>();
  s.projects.forEach(p => p.columns.forEach(c => kinds.set(p.id + ':' + c.id, c.kind)));
  const kindOf = (t: Task): ColumnKind => kinds.get(t.projectId + ':' + t.columnId) ?? 'open';
  const wsTasks = s.tasks.filter(t => projects.some(p => p.id === t.projectId));
  const userById = (id?: string) => s.users.find(u => u.id === id);

  return { me, myWorkspaces, workspace, projects, project, members, myRole, readOnly: myRole === 'viewer', kindOf, wsTasks, userById, today: today() };
}
