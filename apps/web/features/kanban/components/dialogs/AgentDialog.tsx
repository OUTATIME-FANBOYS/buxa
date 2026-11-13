import { useState } from 'react';
import { Dialog, Field, useUi } from '@/components/ui';
import { useStore } from '../../state/store';

export function AgentDialog({ onClose }: { onClose: () => void }) {
  const { actions, workspace, projects } = useStore(); const { toast } = useUi();
  const [name, setName] = useState(''); const [model, setModel] = useState('Claude'); const [purpose, setPurpose] = useState('');
  const [scope, setScope] = useState<string[]>(projects.map(p => p.id)); const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog title="Add an agent" onClose={onClose}>
      <form className="stack" noValidate onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) return setErr('Give the agent a name.');
        if (!workspace) return;
        actions.addAgent(workspace.id, name.trim(), model.trim() || 'Claude', purpose.trim(), scope); toast(`${name.trim()} added. It starts by asking before it changes anything.`); onClose();
      }}>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Release notes agent" maxLength={40} /></Field>
        <Field label="Model or tool" hint="Shown next to its name. It is a label for people; it does not connect anything yet."><input value={model} onChange={e => setModel(e.target.value)} maxLength={40} /></Field>
        <Field label="What is it for?"><textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={200} placeholder="One sentence people will see when reviewing its work." /></Field>
        <fieldset className="field"><legend className="field-label">Projects it may touch</legend>
          {projects.map(p => <label key={p.id} className="check-row"><input type="checkbox" checked={scope.includes(p.id)} onChange={() => setScope(x => (x.includes(p.id) ? x.filter(i => i !== p.id) : [...x, p.id]))} /><span>{p.name}</span></label>)}
        </fieldset>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Add agent</button></div>
      </form>
    </Dialog>
  );
}
