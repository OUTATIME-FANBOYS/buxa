'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
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
        <Dialog
          title="New session"
          onClose={close}
          className="class-dialog"
          footer={
            <>
              <Button variant="glass" type="button" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} variant="primary" icon="plus" disabled={pending}>
                {pending ? 'Saving...' : 'Create session'}
              </Button>
            </>
          }
        >
          <NewSessionForm variant="dialog" formId={FORM_ID} onPendingChange={setPending} />
        </Dialog>
      )}
    </>
  );
}
