'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import type { Class } from '@buxa/contracts';
import { ClassForm, type InstructorChoice } from './ClassForm';

/**
 * Opens a class's edit form in a dialog. The button is an icon with an accessible name and a tooltip. The dialog closes when the
 * change is saved, on Cancel, or on Escape. Cancel and Save class sit in the dialog's pinned footer, so they stay in view however
 * tall the form is.
 */
export function EditClassButton({
  cls,
  sessionName,
  timeZone,
  instructors,
  detailsOnly = false,
}: {
  cls: Class;
  sessionName: string;
  timeZone: string;
  instructors: readonly InstructorChoice[];
  /** A teacher's edit: the form shows the name only. */
  detailsOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const formId = `edit-class-${cls.id}`;

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        iconOnly
        icon="edit"
        aria-label={`Edit ${cls.name}`}
        title="Edit class"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <Dialog
          title="Edit class"
          onClose={close}
          className="class-dialog"
          footer={
            <>
              <Button variant="glass" type="button" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={formId} variant="primary" icon="save" disabled={pending}>
                {pending ? 'Saving...' : 'Save class'}
              </Button>
            </>
          }
        >
          <ClassForm
            sessionId={cls.sessionId}
            sessionName={sessionName}
            timeZone={timeZone}
            instructors={instructors}
            cls={cls}
            variant="dialog"
            detailsOnly={detailsOnly}
            formId={formId}
            onPendingChange={setPending}
            onSaved={close}
          />
        </Dialog>
      )}
    </>
  );
}
