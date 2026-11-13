import { useState } from 'react';
import { Dialog, Field } from '@/components/ui';
import { useStore } from '../../state/store';
import { navigate } from '../../lib/router';

export function WorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { actions } = useStore(); const [name, setName] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="New workspace" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => { e.preventDefault(); if (!name.trim()) return setErr('Give the workspace a name.'); actions.createWorkspace(name.trim()); navigate('/projects'); onClose(); }}>
        <Field label="Name" error={err} hint="Workspaces group projects and the people who work on them."><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus /></Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create workspace</button></div>
      </form>
    </Dialog>
  );
}
