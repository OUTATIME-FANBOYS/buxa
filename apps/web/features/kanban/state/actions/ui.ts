import type { ThemePref, UiState, ViewKind } from '../../types';
import type { ActionContext } from './context';

export function uiActions({ set }: ActionContext) {
  return {
    setUi: (patch: Partial<UiState>) => set(s => ({ ...s, ui: { ...s.ui, ...patch } })),
    setTheme: (theme: ThemePref) => set(s => ({ ...s, ui: { ...s.ui, theme } })),
    setView: (view: ViewKind) => set(s => ({ ...s, ui: { ...s.ui, view } })),
    selectProject: (projectId: string) => set(s => { const p = s.projects.find(x => x.id === projectId); return p ? { ...s, ui: { ...s.ui, projectId, workspaceId: p.workspaceId } } : s; }),
    selectWorkspace: (workspaceId: string) => set(s => ({ ...s, ui: { ...s.ui, workspaceId, projectId: s.projects.find(x => x.workspaceId === workspaceId)?.id ?? '' } })),
  };
}
