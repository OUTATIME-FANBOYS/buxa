'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { ClassForm, type InstructorChoice } from './ClassForm';

const FORM_ID = 'new-class-form';

/**
 * The session page's New class button. It opens the add form in a dialog, so the session's classes stay in view; the dialog closes
 * on Escape, the close button or Cancel, and focus returns to this button. Cancel and Add class sit in the pinned footer.
 */
export function NewClassButton({
  sessionId,
  sessionName,
  instructors,
}: {
  sessionId: string;
  sessionName: string;
  instructors: readonly InstructorChoice[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="glass" size="sm" type="button" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        New class
      </Button>
      {open && (
        <FormPopUp
          title="New class"
          formId={FORM_ID}
          submitLabel="Add class"
          pendingLabel="Saving..."
          submitIcon="plus"
          pending={pending}
          onCancel={close}
        >
          <ClassForm
            sessionId={sessionId}
            sessionName={sessionName}
            instructors={instructors}
            variant="dialog"
            formId={FORM_ID}
            onPendingChange={setPending}
          />
        </FormPopUp>
      )}
    </>
  );
}
