import { memo } from 'react';
import type { Project, Task } from '../../types';
import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import { Avatar, Icon, Menu, PriorityMark } from '@/components/ui';
import { subtaskProgress } from '../../lib/tasks';
import { justDragged } from '../../lib/cardDrag';
import { useTaskCommands } from '../../hooks/useTaskCommands';
import { DueChip } from './DueChip';
import { taskMenuItems } from './taskMenuItems';

interface TaskCardProps {
  task: Task; project: Project; readOnly: boolean; dragging: boolean;
  onGrab: (e: React.PointerEvent<HTMLElement>, id: string) => void;
}

export const TaskCard = memo(function TaskCard({ task, project, readOnly, dragging, onGrab }: TaskCardProps) {
  const { userById, kindOf } = useStore(); const { openTask } = useTaskDrawer(); const cmd = useTaskCommands();
  const kind = kindOf(task); const sp = subtaskProgress(task); const user = userById(task.assigneeId);
  const idx = project.columns.findIndex(c => c.id === task.columnId);
  const move = (to: number) => { const c = project.columns[to]; if (c && !readOnly) cmd.moveTo(task, c); };
  return (
    <article className={`card ${dragging ? 'is-dragging' : ''} ${task.archived ? 'is-archived' : ''}`} data-card-id={task.id} tabIndex={0}
      onPointerDown={e => { if (readOnly || (e.target as HTMLElement).closest('button,a,input,select,textarea')) return; onGrab(e, task.id); }}
      onClick={() => { if (!justDragged()) openTask(task.id); }}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') openTask(task.id);
        if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); move(idx - 1); }
        if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); move(idx + 1); }
      }}
      aria-label={`${task.title}. ${project.columns[idx]?.name}. ${task.priority} priority.${user ? ' Assigned to ' + user.name + '.' : ''}`}>
      <div className="card-top">
        <h3>{task.title}</h3>
        <Menu label={`Actions for ${task.title}`} className="icon-btn card-menu" trigger={<Icon name="more" />} items={taskMenuItems(task, project, readOnly, cmd)} />
      </div>
      {task.tags.length > 0 && <div className="tags">{task.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}{task.tags.length > 3 && <span className="tag">+{task.tags.length - 3}</span>}</div>}
      <div className="card-meta">
        <PriorityMark priority={task.priority} />
        <DueChip due={task.due} kind={kind} />
        {sp.total > 0 && <span className="meta" title="Subtasks"><Icon name="check" size={12} />{sp.done}/{sp.total}</span>}
        {task.comments.length > 0 && <span className="meta" title="Comments"><Icon name="message" size={12} />{task.comments.length}</span>}
        {task.attachments.length > 0 && <span className="meta" title="Attachments"><Icon name="clip" size={12} />{task.attachments.length}</span>}
        <span className="grow" />
        {task.archived && <span className="tag">Archived</span>}
        <Avatar user={user} size={22} />
      </div>
    </article>
  );
});
