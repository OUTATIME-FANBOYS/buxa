import type { Project, Task } from '../../types';
import type { MenuItem } from '@/components/ui';
import type { TaskCommands } from '../../hooks/useTaskCommands';

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
