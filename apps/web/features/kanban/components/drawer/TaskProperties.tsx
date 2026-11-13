import { useMemo } from 'react';
import type { Priority, Project, Task } from '../../types';
import { useStore } from '../../state/store';
import type { TaskDraft } from '../../hooks/useTaskDraft';
import { Field, PriorityMark } from '@/components/ui';
import { PRIORITIES, PRIORITY_LABEL } from '../../lib/tasks';
import { TagInput } from './TagInput';

/** Status, priority, assignee, dates and tags. For a saved task each change is written straight through. */
export function TaskProperties({ task, project, d }: { task: Task | null; project: Project; d: TaskDraft }) {
  const { actions, members, wsTasks } = useStore();
  const allTags = useMemo(() => Array.from(new Set(wsTasks.flatMap(t => t.tags))).sort(), [wsTasks]);
  return (
    <div className="props">
      <Field label="Status">
        <select value={task?.columnId ?? d.columnId} onChange={e => task ? actions.moveTask(task.id, e.target.value, null) : d.setColumnId(e.target.value)}>
          {project.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Priority">
        <span className="select-with"><PriorityMark priority={task?.priority ?? d.priority} />
          <select value={task?.priority ?? d.priority} onChange={e => task ? actions.updateTask(task.id, { priority: e.target.value as Priority }) : d.setPriority(e.target.value as Priority)}>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select></span>
      </Field>
      <Field label="Assignee">
        <select value={(task ? task.assigneeId : d.assignee) ?? ''} onChange={e => task ? actions.updateTask(task.id, { assigneeId: e.target.value || undefined }) : d.setAssignee(e.target.value)}>
          <option value="">Unassigned</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
        </select>
      </Field>
      <Field label="Start date"><input type="date" value={d.start} onChange={e => d.changeDates(e.target.value, d.due, 'start')} /></Field>
      <Field label="Due date" error={d.errs.due}><input type="date" value={d.due} aria-invalid={!!d.errs.due} onChange={e => d.changeDates(d.start, e.target.value, 'due')} /></Field>
      <div className="field span-2"><span className="field-label">Tags</span>
        <TagInput tags={task?.tags ?? d.tags} suggestions={allTags} onChange={t => task ? actions.updateTask(task.id, { tags: t }) : d.setTags(t)} /></div>
    </div>
  );
}
