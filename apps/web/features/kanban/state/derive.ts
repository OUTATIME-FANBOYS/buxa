import type { AppState, ColumnKind, Task } from '../types';
import { today } from '../lib/dates';

/** Everything the screens read from the raw state: who I am, my workspace and project, and lookups. Pure, so it is testable. */
export function deriveView(s: AppState) {
  const me = s.users.find(u => u.id === s.session.userId) ?? null;
  const myWorkspaces = s.workspaces.filter(w => w.members.some(m => m.userId === me?.id));
  const workspace = myWorkspaces.find(w => w.id === s.ui.workspaceId) ?? myWorkspaces[0] ?? null;
  const projects = s.projects.filter(p => p.workspaceId === workspace?.id);
  const project = projects.find(p => p.id === s.ui.projectId) ?? projects[0] ?? null;
  const members = (workspace?.members ?? []).flatMap(m => { const user = s.users.find(u => u.id === m.userId); return user ? [{ ...m, user }] : []; });
  const myRole = workspace?.members.find(m => m.userId === me?.id)?.role ?? 'viewer';
  const kinds = new Map<string, ColumnKind>();
  s.projects.forEach(p => p.columns.forEach(c => kinds.set(p.id + ':' + c.id, c.kind)));
  const kindOf = (t: Task): ColumnKind => kinds.get(t.projectId + ':' + t.columnId) ?? 'open';
  const wsTasks = s.tasks.filter(t => projects.some(p => p.id === t.projectId));
  const userById = (id?: string) => s.users.find(u => u.id === id);
  return { me, myWorkspaces, workspace, projects, project, members, myRole, readOnly: myRole === 'viewer', kindOf, wsTasks, userById, today: today() };
}
