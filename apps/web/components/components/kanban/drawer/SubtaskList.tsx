'use client';

import { useState } from 'react';
import type { Task } from '@buxa/shared';
import { useStore } from '@buxa/middleware/providers/providers';
import { Button } from '@/components/elements';
import { Progress } from '@/components/elements';
import { Checkbox, TextField } from '@/components/atoms';
import { subtaskProgress } from '@buxa/shared';

export function SubtaskList({ task, ro }: { task: Task; ro: boolean }) {
  const { actions } = useStore();
  const [sub, setSub] = useState('');
  const sp = subtaskProgress(task);

  return (
    <section className="section buxa:grid buxa:gap-[var(--s3)]">
      <div className="section-head buxa:flex buxa:justify-between buxa:items-center">
        <h3>Subtasks</h3>
        {sp.total > 0 && (
          <span className="muted small">
            {sp.done} of {sp.total}
          </span>
        )}
      </div>
      {sp.total > 0 && <Progress value={(sp.done / sp.total) * 100} label="Subtask progress" />}
      <ul className="checklist buxa:[&_label]:flex buxa:[&_label]:gap-[var(--s3)] buxa:[&_label]:items-center buxa:[&_label]:[padding:6px_0] buxa:[&_label]:flex-1 buxa:[&_label]:cursor-pointer">
        {task.subtasks.map(st => (
          <li
            key={st.id}
            className="buxa:flex buxa:items-center buxa:justify-between buxa:gap-[var(--s2)] buxa:rounded-[var(--r-1)] buxa:[padding:2px_var(--s1)] buxa:hover:bg-[var(--hover)]"
          >
            <Checkbox isSelected={st.done} isDisabled={ro} onChange={() => actions.toggleSubtask(task.id, st.id)}>
              <span className={st.done ? 'done buxa:line-through buxa:text-[var(--text-3)]' : ''}>{st.title}</span>
            </Checkbox>
            {!ro && (
              <Button
                iconOnly
                icon="x"
                aria-label={`Remove subtask ${st.title}`}
                onClick={() => actions.removeSubtask(task.id, st.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {!ro && (
        <form
          className="inline-form buxa:flex buxa:gap-[var(--s2)]"
          onSubmit={e => {
            e.preventDefault();
            const t = sub.trim();
            if (t) {
              actions.addSubtask(task.id, t);
              setSub('');
            }
          }}
        >
          <TextField
            label="New subtask"
            hideLabel
            value={sub}
            onChange={setSub}
            placeholder="Add a subtask"
            maxLength={140}
          />
          <Button size="sm" icon="plus" disabled={!sub.trim()}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}
