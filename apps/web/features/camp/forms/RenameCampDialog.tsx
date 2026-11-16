'use client';

import { useActionState, useEffect, useState } from 'react';
import { Dialog, useUi } from '@/components/ui';
import { fieldError, idle } from '@/lib/actions/state';
import { renameCampAction } from '../actions';
import { TextField } from './TextField';

const FORM_ID = 'rename-camp';

/** The rename dialog. The camp id travels in the form, but the server checks it against the person's memberships. */
export function RenameCampDialog({ campId, currentName, onClose }: { campId: string; currentName: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(renameCampAction, idle);
  const [name, setName] = useState(currentName);
  const { toast } = useUi();
  const done = state.status === 'success';

  useEffect(() => {
    if (!done) return;
    toast('Camp renamed');
    onClose();
  }, [done, toast, onClose]);

  const formMessage = state.status === 'error' && !state.fieldErrors ? state.message : undefined;
  return (
    <Dialog title="Rename camp" onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form={FORM_ID} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button></>}>
      <form id={FORM_ID} action={formAction}>
        <input type="hidden" name="campId" value={campId} />
        <TextField label="Camp name" name="name" value={name} onChange={setName} error={fieldError(state, 'name')} maxLength={120} autoFocus />
        {formMessage && <p className="field-error" role="alert">{formMessage}</p>}
      </form>
    </Dialog>
  );
}
