'use client';

import { useReducer, useState, type FormEvent, type Reducer } from 'react';
import { Dialog, Field, useUi } from '@/features/kanban/components/ui';
import { ApiError } from '../api/client';
import { editing, submissionReducer, type Submission, type SubmissionAction } from '../forms/submission';
import { validateCampName } from '../forms/validators';
import { useCamp } from '../state/CampProvider';

type FieldName = 'name';
const reducer: Reducer<Submission<FieldName>, SubmissionAction<FieldName>> = submissionReducer;

export function RenameDialog({ orgId, currentName, onClose, onRenamed }: { orgId: string; currentName: string; onClose: () => void; onRenamed: () => void }) {
  const { api, reload } = useCamp();
  const { toast } = useUi();
  const [name, setName] = useState(currentName);
  const [submission, dispatch] = useReducer(reducer, editing<FieldName>());
  const error = submission.status === 'editing' ? submission.errors.name : submission.status === 'failed' ? submission.message : undefined;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateCampName(name);
    if (problem) { dispatch({ type: 'invalid', errors: { name: problem } }); return; }
    dispatch({ type: 'submit' });
    try {
      await api.renameOrg(orgId, name.trim());
      await reload();
      toast('Camp renamed');
      onRenamed();
      onClose();
    } catch (caught) {
      dispatch({ type: 'failed', message: caught instanceof ApiError ? caught.message : 'Could not rename the camp.' });
    }
  };

  return (
    <Dialog title="Rename camp" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="rename" disabled={submission.status === 'submitting'}>Save</button></>}>
      <form id="rename" onSubmit={save} noValidate>
        <Field label="Camp name" error={error}>
          <input value={name} onChange={e => { setName(e.target.value); dispatch({ type: 'edit' }); }} maxLength={120} data-autofocus autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
