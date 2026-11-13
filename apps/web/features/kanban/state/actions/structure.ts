import type { Column, ColumnKind, Role } from '../../types';
import * as D from '../../lib/domain';
import { uid } from '../../lib/tasks';
import type { ActionContext } from './context';

/** Columns, projects, workspaces and members. */
export function structureActions({ set, get }: ActionContext) {
  return {
    createColumn: (projectId: string, name: string, kind: ColumnKind) => set(s => D.createColumn(s, projectId, name, kind)),
    updateColumn: (projectId: string, colId: string, patch: Partial<Column>) => set(s => D.updateColumn(s, projectId, colId, patch)),
    deleteColumn: (projectId: string, colId: string, moveTo: string) => set(s => D.deleteColumn(s, projectId, colId, moveTo)),
    moveColumn: (projectId: string, colId: string, beforeId: string | null) => set(s => D.moveColumn(s, projectId, colId, beforeId)),
    createProject(workspaceId: string, name: string, description: string, deadline?: string): string { const id = 'p-' + uid(); set(s => D.createProject(s, id, workspaceId, name, description, deadline)); return id; },
    updateProject: (id: string, patch: Partial<{ name: string; description: string; deadline?: string }>) => set(s => D.updateProject(s, id, patch)),
    deleteProject: (id: string) => set(s => D.deleteProject(s, id)),
    createWorkspace(name: string): string { const id = 'w-' + uid(); set(s => D.createWorkspace(s, id, name)); return id; },
    invite(workspaceId: string, email: string, role: Role): string | null {
      const r = D.invite(get(), workspaceId, email, role); if (!r.error) set(s => D.invite(s, workspaceId, email, role).state); return r.error;
    },
    setRole: (w: string, u: string, role: Role) => set(s => D.setRole(s, w, u, role)),
    removeMember: (w: string, u: string) => set(s => D.removeMember(s, w, u)),
  };
}
