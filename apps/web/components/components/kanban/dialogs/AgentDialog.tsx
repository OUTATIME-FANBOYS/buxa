'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components/export';
import { Field, Button } from '@/components/elements/export';
import { Checkbox, TextField } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { useStore } from '@buxa/middleware/providers/providers';

export function AgentDialog({ onClose }: { onClose: () => void }) {
  const { actions, workspace, projects } = useStore();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [model, setModel] = useState('Claude');
  const [purpose, setPurpose] = useState('');
  const [scope, setScope] = useState<string[]>(projects.map(p => p.id));
  const [err, setErr] = useState<string | null>(null);

  return (
    <Dialog title="Add an agent" onClose={onClose}>
      <form
        className="stack"
        noValidate
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) {
            return setErr('Give the agent a name.');
          }
          if (!workspace) {
            return;
          }
          actions.addAgent(workspace.id, name.trim(), model.trim() || 'Claude', purpose.trim(), scope);
          toast(`${name.trim()} added. It starts by asking before it changes anything.`);
          onClose();
        }}
      >
        <TextField
          label="Name"
          error={err}
          value={name}
          onChange={value => {
            setName(value);
            setErr(null);
          }}
          autoFocus
          placeholder="e.g. Packing list agent"
          maxLength={40}
        />
        <TextField
          label="Model or tool"
          hint="Shown next to its name. It is a label for people; it does not connect anything yet."
          value={model}
          onChange={setModel}
          maxLength={40}
        />
        <Field label="What is it for?">
          <textarea
            rows={2}
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            maxLength={200}
            placeholder="One sentence people will see when reviewing its work."
          />
        </Field>
        <fieldset className="field">
          <legend className="field-label">Projects it may touch</legend>
          {projects.map(p => (
            <Checkbox
              key={p.id}
              className="check-row"
              isSelected={scope.includes(p.id)}
              onChange={() => setScope(x => (x.includes(p.id) ? x.filter(i => i !== p.id) : [...x, p.id]))}
            >
              {p.name}
            </Checkbox>
          ))}
        </fieldset>
        <div className="row-end">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="plus">
            Add agent
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
