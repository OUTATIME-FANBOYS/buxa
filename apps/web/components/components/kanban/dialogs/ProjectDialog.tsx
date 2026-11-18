'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components/export';
import { Field, Button } from '@/components/elements/export';
import { DatePicker, formatLocalDate, parseLocalDate, TextField } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { boardPath } from '@/config/routes';
import { useStore } from '@buxa/middleware/providers/providers';
import type { Project } from '@buxa/shared';

export function ProjectDialog({ project, onClose }: { project?: Project; onClose: () => void }) {
  const router = useRouter();
  const { actions, workspace } = useStore();
  const { toast } = useUi();
  const [name, setName] = useState(project?.name ?? '');
  const [desc, setDesc] = useState(project?.description ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return setErr('Give the project a name.');
    }
    if (name.length > 60) {
      return setErr('Keep the name under 60 characters.');
    }
    if (project) {
      actions.updateProject(project.id, {
        name: name.trim(),
        description: desc.trim(),
        deadline: deadline || undefined,
      });
      toast('Project updated');
    } else if (workspace) {
      const id = actions.createProject(workspace.id, name.trim(), desc.trim(), deadline || undefined);
      router.push(boardPath(id));
      toast('Project created');
    }
    onClose();
  };

  return (
    <Dialog title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="stack" noValidate>
        <TextField
          label="Name"
          error={err}
          value={name}
          onChange={value => {
            setName(value);
            setErr(null);
          }}
          autoFocus
          placeholder="e.g. Summer 2028 Registration"
        />
        <Field label="Description">
          <textarea
            rows={3}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={300}
            placeholder="What is this project for?"
          />
        </Field>
        <DatePicker
          label="Deadline"
          value={parseLocalDate(deadline)}
          onChange={value => setDeadline(formatLocalDate(value))}
        />
        <div className="row-end">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={project ? 'save' : 'plus'}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
