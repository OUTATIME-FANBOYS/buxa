import { useState } from 'react';
import type { Task } from '../../types';
import { useStore } from '../../state/store';
import { Icon, Progress } from '@/components/ui';
import { subtaskProgress } from '../../lib/tasks';

export function SubtaskList({ task, ro }: { task: Task; ro: boolean }) {
  const { actions } = useStore(); const [sub, setSub] = useState('');
  const sp = subtaskProgress(task);
  return (
    <section className="section">
      <div className="section-head"><h3>Subtasks</h3>{sp.total > 0 && <span className="muted small">{sp.done} of {sp.total}</span>}</div>
      {sp.total > 0 && <Progress value={(sp.done / sp.total) * 100} label="Subtask progress" />}
      <ul className="checklist">
        {task.subtasks.map(st => (
          <li key={st.id}>
            <label><input type="checkbox" checked={st.done} disabled={ro} onChange={() => actions.toggleSubtask(task.id, st.id)} /><span className={st.done ? 'done' : ''}>{st.title}</span></label>
            {!ro && <button className="icon-btn" aria-label={`Remove subtask ${st.title}`} onClick={() => actions.removeSubtask(task.id, st.id)}><Icon name="x" size={14} /></button>}
          </li>
        ))}
      </ul>
      {!ro && <form className="inline-form" onSubmit={e => { e.preventDefault(); const t = sub.trim(); if (t) { actions.addSubtask(task.id, t); setSub(''); } }}>
        <input value={sub} onChange={e => setSub(e.target.value)} placeholder="Add a subtask" aria-label="New subtask" maxLength={140} /><button className="btn btn-sm" disabled={!sub.trim()}>Add</button></form>}
    </section>
  );
}
