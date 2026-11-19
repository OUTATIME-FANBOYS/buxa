'use client';

import { PriorityMark } from '@/components/elements';
import { useMemo } from 'react';
import type { Priority, Project, Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import type { TaskDraft } from '@buxa/middleware/hooks/hooks';
import { PRIORITIES, PRIORITY_LABEL } from '@buxa/shared';
import { DatePicker, Select } from '@/components/atoms';
import { firstNameOf } from '@buxa/shared/names';
import { TagInput } from './TagInput';
import { statusMark, type StatusMark } from './statusMark';

// The status field takes its status's token for the border and the text (the --st-* tokens in tokens.css).
const STATUS_FIELD: Record<StatusMark['token'], string> = {
  backlog: 'buxa:[&_select]:border-[var(--st-backlog)]! buxa:[&_select]:text-[var(--st-backlog)]!',
  todo: 'buxa:[&_select]:border-[var(--st-todo)]! buxa:[&_select]:text-[var(--st-todo)]!',
  progress: 'buxa:[&_select]:border-[var(--st-progress)]! buxa:[&_select]:text-[var(--st-progress)]!',
  review: 'buxa:[&_select]:border-[var(--st-review)]! buxa:[&_select]:text-[var(--st-review)]!',
  done: 'buxa:[&_select]:border-[var(--st-done)]! buxa:[&_select]:text-[var(--st-done)]!',
};

// The priority field takes its chosen priority's token for the border and the text (the same tokens as PriorityMark).
const PRIORITY_FIELD: Record<Priority, string> = {
  low: 'buxa:[&_select]:border-[var(--p-low)]! buxa:[&_select]:text-[var(--p-low)]!',
  medium: 'buxa:[&_select]:border-[var(--p-medium)]! buxa:[&_select]:text-[var(--p-medium)]!',
  high: 'buxa:[&_select]:border-[var(--p-high)]! buxa:[&_select]:text-[var(--p-high)]!',
  critical: 'buxa:[&_select]:border-[var(--p-critical)]! buxa:[&_select]:text-[var(--p-critical)]!',
};

/** Status, priority, assignee, dates and tags. For a saved task each change is written straight through. */
export function TaskProperties({ task, project, d }: { task: Task | null; project: Project; d: TaskDraft }) {
  const { actions, members, wsTasks } = useStore();
  const allTags = useMemo(() => Array.from(new Set(wsTasks.flatMap(t => t.tags))).sort(), [wsTasks]);
  const currentColumn = project.columns.find(c => c.id === (task?.columnId ?? d.columnId));
  const currentMark = currentColumn ? statusMark(currentColumn) : undefined;

  return (
    <div className="props buxa:grid buxa:grid-cols-[1fr_1fr] buxa:gap-[var(--s4)]">
      <Select
        label="Status"
        className={currentMark ? STATUS_FIELD[currentMark.token] : undefined}
        leading={
          currentMark ? (
            <span
              aria-hidden="true"
              className="buxa:absolute buxa:left-[10px] buxa:top-1/2 buxa:-translate-y-1/2 buxa:pointer-events-none buxa:text-[length:var(--fs-s)] buxa:leading-none"
            >
              {currentMark.emoji}
            </span>
          ) : undefined
        }
        value={task?.columnId ?? d.columnId}
        onChange={value => {
          if (value === null) {
            return;
          }
          if (task) {
            actions.moveTask(task.id, value, null);
          } else {
            d.setColumnId(value);
          }
        }}
        options={project.columns.map(c => ({ value: c.id, label: `${statusMark(c).emoji} ${c.name}` }))}
      />
      <Select
        label="Priority"
        className={PRIORITY_FIELD[task?.priority ?? d.priority]}
        leading={
          <PriorityMark
            priority={task?.priority ?? d.priority}
            className="buxa:absolute buxa:left-[10px] buxa:top-1/2 buxa:-translate-y-1/2 buxa:pointer-events-none"
          />
        }
        value={task?.priority ?? d.priority}
        onChange={value => {
          if (value === null) {
            return;
          }
          const priority = value as Priority;
          if (task) {
            actions.updateTask(task.id, { priority });
          } else {
            d.setPriority(priority);
          }
        }}
        options={PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABEL[p] }))}
      />
      <Select
        label="Assignee"
        value={(task ? task.assigneeId : d.assignee) ?? ''}
        onChange={value => {
          const assignee = value ?? '';
          if (task) {
            actions.updateTask(task.id, { assigneeId: assignee || undefined });
          } else {
            d.setAssignee(assignee);
          }
        }}
        options={[
          { value: '', label: 'Unassigned' },
          ...members.map(m => ({ value: m.userId, label: firstNameOf(m.user.name) })),
        ]}
      />
      <DatePicker label="Start date" value={d.start} onChange={value => d.changeDates(value ?? '', d.due, 'start')} />
      <DatePicker
        label="Due date"
        error={d.errs.due}
        value={d.due}
        onChange={value => d.changeDates(d.start, value ?? '', 'due')}
      />
      {/* Same wrapper and label gap as the Select and DatePicker fields beside it, so the row lines up. */}
      <div className="select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0">
        <span className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]">
          Tags
        </span>
        <TagInput
          tags={task?.tags ?? d.tags}
          suggestions={allTags}
          onChange={t => (task ? actions.updateTask(task.id, { tags: t }) : d.setTags(t))}
        />
      </div>
    </div>
  );
}
