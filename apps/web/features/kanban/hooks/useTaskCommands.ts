/** One place for what "duplicate / archive / delete / move" mean to the user, including the toast and the undo. */
import { useMemo } from 'react';
import type { Column, Project, Task } from '../types';
import { useStore } from '../store';
import { useUi, type MenuItem } from '@/components/ui';

export function useTaskCommands() {
  const { actions } = useStore(); const { toast, openTask } = useUi();
  return useMemo(() => ({
    open: (t: Task) => openTask(t.id),
    moveTo(t: Task, c: Column) { actions.moveTask(t.id, c.id, null); toast(`Moved to ${c.name}`); },
    duplicate(t: Task) { const id = actions.duplicateTask(t.id); toast('Task duplicated', { action: { label: 'Open', run: () => openTask(id) } }); return id; },
    toggleArchive(t: Task) { actions.archiveTask(t.id, !t.archived); toast(t.archived ? 'Task restored' : 'Task archived'); },
    remove(t: Task) { actions.deleteTask(t.id); toast('Task deleted', { action: { label: 'Undo', run: () => actions.restoreTask(t) } }); },
  }), [actions, toast, openTask]);
}
export type TaskCommands = ReturnType<typeof useTaskCommands>;

/** The ⋯ menu for a task card. Read-only members only get "Open". */
export function taskMenuItems(t: Task, project: Project, readOnly: boolean, cmd: TaskCommands): (MenuItem | false)[] {
  if (readOnly) return [{ label: 'Open', icon: 'edit', onSelect: () => cmd.open(t) }];
  return [
    { label: 'Open', icon: 'edit', onSelect: () => cmd.open(t) },
    { label: 'Duplicate', icon: 'copy', onSelect: () => cmd.duplicate(t) },
    ...project.columns.filter(c => c.id !== t.columnId).map(c => ({ label: `Move to ${c.name}`, icon: 'arrowRight', onSelect: () => cmd.moveTo(t, c) })),
    { label: t.archived ? 'Restore' : 'Archive', icon: 'archive', onSelect: () => cmd.toggleArchive(t) },
    { label: 'Delete', icon: 'trash', danger: true, onSelect: () => cmd.remove(t) },
  ];
}
