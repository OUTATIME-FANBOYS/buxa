/** One place for what "duplicate / archive / delete / move" mean to the user, including the toast and the undo. */
import { useMemo } from 'react';
import type { Column, Task } from '../types';
import { useStore } from '../state/store';
import { useTaskDrawer } from '../state/TaskDrawerContext';
import { useUi } from '@/components/ui';

export function useTaskCommands() {
  const { actions } = useStore(); const { toast } = useUi(); const { openTask } = useTaskDrawer();
  return useMemo(() => ({
    open: (t: Task) => openTask(t.id),
    moveTo(t: Task, c: Column) { actions.moveTask(t.id, c.id, null); toast(`Moved to ${c.name}`); },
    duplicate(t: Task) { const id = actions.duplicateTask(t.id); toast('Task duplicated', { action: { label: 'Open', run: () => openTask(id) } }); return id; },
    toggleArchive(t: Task) { actions.archiveTask(t.id, !t.archived); toast(t.archived ? 'Task restored' : 'Task archived'); },
    remove(t: Task) { actions.deleteTask(t.id); toast('Task deleted', { action: { label: 'Undo', run: () => actions.restoreTask(t) } }); },
  }), [actions, toast, openTask]);
}
export type TaskCommands = ReturnType<typeof useTaskCommands>;
