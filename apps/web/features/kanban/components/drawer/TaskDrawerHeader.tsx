import type { Project, Task } from '../../types';
import { Icon, Menu } from '@/components/ui';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { useTaskCommands } from '../../hooks/useTaskCommands';

export function TaskDrawerHeader({ task, project, readOnly, onClose, onDelete }: { task: Task | null; project: Project; readOnly: boolean; onClose: () => void; onDelete: () => void }) {
  const { openTask } = useTaskDrawer(); const cmd = useTaskCommands();
  const col = project.columns.find(c => c.id === task?.columnId);
  return (
    <div className="drawer-head" data-sheet-handle>
      <div className="muted small crumbs-mini">{project.name} <Icon name="right" size={12} /> {task ? col?.name : 'New task'}</div>
      <span className="grow" />
      {task && !readOnly && <Menu label="Task actions" trigger={<Icon name="more" />} items={[
        { label: 'Duplicate', icon: 'copy', onSelect: () => openTask(cmd.duplicate(task)) },
        { label: task.archived ? 'Restore' : 'Archive', icon: 'archive', onSelect: () => cmd.toggleArchive(task) },
        { label: '', divider: true, onSelect() {} }, { label: 'Delete', icon: 'trash', danger: true, onSelect: onDelete }]} />}
      <button className="icon-btn" onClick={onClose} aria-label="Close task"><Icon name="x" /></button>
    </div>
  );
}
