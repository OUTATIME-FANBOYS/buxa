'use client';

import { PriorityMark } from '@/components/elements';
import { useMemo } from 'react';
import type { Priority, Project, Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import type { TaskDraft } from '@buxa/middleware/hooks/hooks';
import { Field } from '@/components/elements';
import { PRIORITIES, PRIORITY_LABEL } from '@buxa/shared';
import { DatePicker, Select } from '@/components/atoms';
import { firstNameOf } from '@buxa/shared/names';
import { TagInput } from './TagInput';

/** Status, priority, assignee, dates and tags. For a saved task each change is written straight through. */
export function TaskProperties({ task, project, d }: { task: Task | null; project: Project; d: TaskDraft }) {
  const { actions, members, wsTasks } = useStore();
  const allTags = useMemo(() => Array.from(new Set(wsTasks.flatMap(t => t.tags))).sort(), [wsTasks]);

  return (
    <div className="props buxa:grid buxa:grid-cols-[1fr_1fr] buxa:gap-[var(--s4)]">
      <Select
        label="Status"
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
      <span className="select-with buxa:relative buxa:block buxa:[&_select]:pl-[32px]!">
        <PriorityMark
          priority={task?.priority ?? d.priority}
          className="buxa:absolute buxa:left-[10px] buxa:top-[10px] buxa:pointer-events-none"
        />
        <Select
          label="Priority"
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
      </span>
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
      <Field label="Tags">
        <TagInput
          tags={task?.tags ?? d.tags}
          suggestions={allTags}
          onChange={t => (task ? actions.updateTask(task.id, { tags: t }) : d.setTags(t))}
        />
      </Field>
    </div>
  );
}
