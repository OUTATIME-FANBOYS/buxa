import { useState } from 'react';
import { Dialog, Field } from '@/components/ui';
import { useStore } from '../../state/store';
import type { Column, ColumnKind } from '../../types';

export function ColumnDialog({ projectId, column, onClose }: { projectId: string; column?: Column; onClose: () => void }) {
  const { actions } = useStore();
  const [name, setName] = useState(column?.name ?? ''); const [kind, setKind] = useState<ColumnKind>(column?.kind ?? 'active'); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title={column ? 'Edit column' : 'New column'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return setErr('Name the column.');
        if (name.length > 30) return setErr('Keep it under 30 characters.');
        if (column) actions.updateColumn(projectId, column.id, { name: name.trim(), kind }); else actions.createColumn(projectId, name.trim(), kind);
        onClose();
      }}>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Blocked" /></Field>
        <Field label="Counts as" hint="Used by the dashboard and reports to measure progress.">
          <select value={kind} onChange={e => setKind(e.target.value as ColumnKind)}>
            <option value="open">Not started</option><option value="active">In progress</option><option value="done">Done</option>
          </select>
        </Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">{column ? 'Save' : 'Add column'}</button></div>
      </form>
    </Dialog>
  );
}
