'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { FormEditor } from './FormEditor';

const FORM_ID = 'new-registration-form';

/**
 * The New registration form button on the registration list. It opens the create form in a dialog, so the list stays in view.
 * Cancel and Create form sit in the dialog's pinned footer, outside the scrolling body.
 */
export function NewRegistrationFormButton({ sessions }: { sessions: readonly { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="primary" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        New registration form
      </Button>
      {open && (
        <FormPopUp
          title="New registration form"
          formId={FORM_ID}
          submitLabel="Create form"
          pendingLabel="Saving..."
          submitIcon="plus"
          pending={pending}
          submitDisabled={sessions.length === 0}
          onCancel={close}
        >
          <FormEditor mode="create" variant="dialog" id={FORM_ID} sessions={sessions} onPendingChange={setPending} />
        </FormPopUp>
      )}
    </>
  );
}
