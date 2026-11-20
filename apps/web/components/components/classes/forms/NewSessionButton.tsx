'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { NewSessionForm } from './NewSessionForm';
import { Button } from '@/components/elements';

const FORM_ID = 'new-session-form';

/**
 * The Sessions page's New session button. It opens the create form in a dialog, so the list stays in view; the dialog closes
 * on Escape, the close button or Cancel, and focus returns to this button. Cancel and Create session sit in the dialog's pinned
 * footer, outside the scrolling body.
 */
export function NewSessionButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // A created session closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button
        variant="primary"
        type="button"
        icon="plus"
        className="classes-target"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        New session
      </Button>
      {open && (
        <FormPopUp
          title="New session"
          formId={FORM_ID}
          submitLabel="Create session"
          pendingLabel="Saving..."
          submitIcon="plus"
          pending={pending}
          onCancel={close}
        >
          <NewSessionForm variant="dialog" formId={FORM_ID} onPendingChange={setPending} onSaved={saved} />
        </FormPopUp>
      )}
    </>
  );
}
