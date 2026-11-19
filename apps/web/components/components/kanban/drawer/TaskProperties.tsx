'use client';

import { PriorityMark } from '@/components/elements';
import type { Priority, Project, Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import type { TaskDraft } from '@buxa/middleware/hooks/hooks';
import { PRIORITIES, PRIORITY_LABEL } from '@buxa/shared';
import { DatePicker, Select } from '@/components/atoms';
import { firstNameOf } from '@buxa/shared/names';
import { statusMark, type StatusMark } from './statusMark';

// The status field takes its status's colour for the border and its ink for the text (the --status-* tokens in tokens.css).
const STATUS_FIELD: Record<StatusMark['colour'], string> = {
  pink: 'buxa:[&_select]:border-[var(--status-pink)]! buxa:[&_select]:text-[var(--status-pink-ink)]!',
  blue: 'buxa:[&_select]:border-[var(--status-blue)]! buxa:[&_select]:text-[var(--status-blue-ink)]!',
  orange: 'buxa:[&_select]:border-[var(--status-orange)]! buxa:[&_select]:text-[var(--status-orange-ink)]!',
  purple: 'buxa:[&_select]:border-[var(--status-purple)]! buxa:[&_select]:text-[var(--status-purple-ink)]!',
  green: 'buxa:[&_select]:border-[var(--status-green)]! buxa:[&_select]:text-[var(--status-green-ink)]!',
};

// The priority field takes its chosen priority's token for the border and the text (the same tokens as PriorityMark).
const PRIORITY_FIELD: Record<Priority, string> = {
  low: 'buxa:[&_select]:border-[var(--p-low)]! buxa:[&_select]:text-[var(--p-low)]!',
  medium: 'buxa:[&_select]:border-[var(--p-medium)]! buxa:[&_select]:text-[var(--p-medium)]!',
  high: 'buxa:[&_select]:border-[var(--p-high)]! buxa:[&_select]:text-[var(--p-high)]!',
  critical: 'buxa:[&_select]:border-[var(--p-critical)]! buxa:[&_select]:text-[var(--p-critical)]!',
};

/**
 * Status, priority and assignee on one line, then the start and due dates. For a saved task each change is written straight
 * through.
 */
export function TaskProperties({ task, project, d }: { task: Task | null; project: Project; d: TaskDraft }) {
  const { actions, members } = useStore();
  const currentColumn = project.columns.find(c => c.id === (task?.columnId ?? d.columnId));
  const currentMark = currentColumn ? statusMark(currentColumn) : undefined;

  return (
    <div className="props buxa:grid buxa:gap-[var(--s4)]">
      <div className="buxa:grid buxa:grid-cols-[repeat(3,minmax(0,1fr))] buxa:gap-[var(--s4)]">
        <Select
          label="Status"
          className={currentMark ? STATUS_FIELD[currentMark.colour] : undefined}
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
          options={project.columns.map(c => ({ value: c.id, label: c.name }))}
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
      </div>
      <div className="buxa:grid buxa:grid-cols-[repeat(2,minmax(0,1fr))] buxa:gap-[var(--s4)]">
        <DatePicker label="Start date" value={d.start} onChange={value => d.changeDates(value ?? '', d.due, 'start')} />
        <DatePicker
          label="Due date"
          error={d.errs.due}
          value={d.due}
          onChange={value => d.changeDates(d.start, value ?? '', 'due')}
        />
      </div>
    </div>
  );
}
