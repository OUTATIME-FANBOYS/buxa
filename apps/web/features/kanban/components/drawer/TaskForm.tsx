import type { Project, Task } from '../../types';
import { useStore } from '../../state/store';
import { Dialog, Field, useUi } from '@/components/ui';
import { useTaskCommands } from '../../hooks/useTaskCommands';
import { useTaskDraft } from '../../hooks/useTaskDraft';
import { TaskDrawerHeader } from './TaskDrawerHeader';
import { TaskProperties } from './TaskProperties';
import { TaskSections } from './TaskSections';

interface TaskFormProps { task: Task | null; project: Project; defaults?: { columnId?: string; due?: string }; onClose: () => void }

/** The task drawer's content: header, title, properties, description, then (for a saved task) subtasks, files and discussion. */
export function TaskForm({ task, project, defaults, onClose }: TaskFormProps) {
  const { actions, readOnly: ro, members, userById } = useStore(); const { confirm } = useUi(); const cmd = useTaskCommands();
  const d = useTaskDraft(task, project, defaults);
  const del = async () => {
    if (task && await confirm({ title: 'Delete this task?', body: 'Comments, files and history go with it. You can undo right after.', confirmLabel: 'Delete', danger: true })) { cmd.remove(task); onClose(); }
  };
  return (
    <Dialog drawer onClose={onClose} labelledBy="drawer-title">{close => (<>
      <TaskDrawerHeader task={task} project={project} readOnly={ro} onClose={close} onDelete={del} />
      <fieldset disabled={ro} className="plain">
        <div className="drawer-title">
          <label className="sr-only" htmlFor="drawer-title">Title</label>
          <textarea id="drawer-title" rows={1} value={d.title} placeholder="Task title" data-autofocus={d.isNew || undefined} aria-invalid={!!d.errs.title}
            onChange={e => { d.setTitle(e.target.value); d.clearTitleError(); }} onBlur={d.commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (d.isNew) d.create(); else (e.target as HTMLElement).blur(); } }} />
          {d.errs.title && <span className="field-error" role="alert">{d.errs.title}</span>}
          {task?.archived && <span className="tag">Archived</span>}
        </div>
        <TaskProperties task={task} project={project} d={d} />
        <Field label="Description">
          <textarea rows={4} value={d.desc} placeholder="Add context, links, acceptance criteria…" onChange={e => d.setDesc(e.target.value)}
            onBlur={() => { if (task && d.desc !== task.description) actions.updateTask(task.id, { description: d.desc }); }} />
        </Field>
      </fieldset>
      {task
        ? <TaskSections task={task} ro={ro} members={members.map(m => m.user)} userById={userById} />
        : <div className="row-end sticky-foot"><button className="btn" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={d.create}>Create task</button></div>}
    </>)}</Dialog>
  );
}
