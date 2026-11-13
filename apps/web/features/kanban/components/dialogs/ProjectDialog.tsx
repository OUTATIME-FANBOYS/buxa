import { useState } from 'react';
import { Dialog, Field, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import type { Project } from '../../types';
import { navigate } from '../../lib/router';

export function ProjectDialog({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { actions, workspace } = useStore(); const { toast } = useUi();
  const [name, setName] = useState(project?.name ?? ''); const [desc, setDesc] = useState(project?.description ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? ''); const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Give the project a name.');
    if (name.length > 60) return setErr('Keep the name under 60 characters.');
    if (project) { actions.updateProject(project.id, { name: name.trim(), description: desc.trim(), deadline: deadline || undefined }); toast('Project updated'); }
    else if (workspace) { const id = actions.createProject(workspace.id, name.trim(), desc.trim(), deadline || undefined); navigate('/board/' + id); toast('Project created'); }
    onClose();
  };
  return (
    <Dialog title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        <Field label="Name" error={err}><input value={name} onChange={e => { setName(e.target.value); setErr(null); }} data-autofocus placeholder="e.g. Brand refresh" /></Field>
        <Field label="Description"><textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} maxLength={300} placeholder="What is this project for?" /></Field>
        <Field label="Deadline"><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">{project ? 'Save' : 'Create project'}</button></div>
      </form>
    </Dialog>
  );
}
