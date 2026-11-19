import type { Project, Task } from '@buxa/shared';
import { Icon, Button } from '@/components/elements';
import { Menu } from '@/components/components';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { useTaskCommands } from '@buxa/middleware/hooks/hooks';

export function TaskDrawerHeader({
  task,
  project,
  readOnly,
  onClose,
  onDelete,
}: {
  task: Task | null;
  project: Project;
  readOnly: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { openTask } = useTaskDrawer();
  const cmd = useTaskCommands();
  const col = project.columns.find(c => c.id === task?.columnId);

  return (
    <div
      className="drawer-head buxa:[touch-action:none] buxa:cursor-grab buxa:flex buxa:items-center buxa:gap-[var(--s1)] buxa:[padding:var(--s3)_0_0] buxa:sticky buxa:top-0 buxa:bg-[var(--surface)] buxa:z-[2]"
      data-sheet-handle
    >
      <div className="muted small crumbs-mini buxa:flex buxa:items-center buxa:gap-[4px]">
        {project.name} <Icon name="right" size={12} /> {task ? col?.name : 'New task'}
      </div>
      <span className="grow" />
      {task && !readOnly && (
        <Menu
          label="Task actions"
          trigger={<Icon name="more" />}
          items={[
            { label: 'Duplicate', icon: 'copy', onSelect: () => openTask(cmd.duplicate(task)) },
            { label: task.archived ? 'Restore' : 'Archive', icon: 'archive', onSelect: () => cmd.toggleArchive(task) },
            { label: '', divider: true, onSelect() {} },
            { label: 'Delete', icon: 'trash', danger: true, onSelect: onDelete },
          ]}
        />
      )}
      <Button iconOnly icon="x" onClick={onClose} aria-label="Close task" />
    </div>
  );
}
