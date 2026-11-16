import { useState } from 'react';
import type { Column, Project } from '../../types';
import { useStore } from '../../state/store';

export function QuickAdd({ project, column, onDone }: { project: Project; column: Column; onDone: () => void }) {
  const { actions, me } = useStore(); const [v, setV] = useState(''); const [err, setErr] = useState('');
  const submit = () => {
    const t = v.trim(); if (!t) return setErr('Add a title first.'); if (t.length > 140) return setErr('Keep titles under 140 characters.');
    actions.createTask({ projectId: project.id, columnId: column.id, title: t, assigneeId: me?.id }); setV(''); setErr('');
  };
  return (
    <div className="quick-add">
      <textarea autoFocus rows={2} value={v} placeholder="What needs doing?" aria-label={`New task in ${column.name}`} aria-invalid={!!err}
        onChange={e => { setV(e.target.value); setErr(''); }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { e.stopPropagation(); onDone(); } }} />
      {err && <span className="field-error" role="alert">{err}</span>}
      <div className="row"><button className="btn btn-primary btn-sm" onClick={submit}>Add</button><button className="btn btn-ghost btn-sm" onClick={onDone}>Done</button><span className="muted small grow" style={{ textAlign: 'right' }}>Enter to add</span></div>
    </div>
  );
}
