'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
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
  timeZone,
  instructors,
}: {
  sessionId: string;
  sessionName: string;
  timeZone: string;
  instructors: readonly InstructorChoice[];
}) {
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
        New class
      </Button>
      {open && (
        <Dialog
          title="New class"
          onClose={close}
          className="class-dialog"
          footer={
            <>
              <Button variant="glass" type="button" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} variant="primary" icon="plus" disabled={pending}>
                {pending ? 'Saving...' : 'Add class'}
              </Button>
            </>
          }
        >
          <ClassForm
            sessionId={sessionId}
            sessionName={sessionName}
            timeZone={timeZone}
            instructors={instructors}
            variant="dialog"
            formId={FORM_ID}
            onPendingChange={setPending}
          />
        </Dialog>
      )}
    </>
  );
}
