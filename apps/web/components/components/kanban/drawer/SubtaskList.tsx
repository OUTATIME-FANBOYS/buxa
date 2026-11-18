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
    <section className="section">
      <div className="section-head">
        <h3>Subtasks</h3>
        {sp.total > 0 && (
          <span className="muted small">
            {sp.done} of {sp.total}
          </span>
        )}
      </div>
      {sp.total > 0 && <Progress value={(sp.done / sp.total) * 100} label="Subtask progress" />}
      <ul className="checklist">
        {task.subtasks.map(st => (
          <li key={st.id}>
            <Checkbox isSelected={st.done} isDisabled={ro} onChange={() => actions.toggleSubtask(task.id, st.id)}>
              <span className={st.done ? 'done' : ''}>{st.title}</span>
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
          className="inline-form"
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
