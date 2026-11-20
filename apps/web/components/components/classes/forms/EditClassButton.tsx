'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
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
  instructors,
  detailsOnly = false,
}: {
  cls: Class;
  sessionName: string;
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
        <FormPopUp
          title="Edit class"
          formId={formId}
          submitLabel="Save class"
          pendingLabel="Saving..."
          submitIcon="save"
          pending={pending}
          onCancel={close}
        >
          <ClassForm
            sessionId={cls.sessionId}
            sessionName={sessionName}
            instructors={instructors}
            cls={cls}
            variant="dialog"
            detailsOnly={detailsOnly}
            formId={formId}
            onPendingChange={setPending}
            onSaved={close}
          />
        </FormPopUp>
      )}
    </>
  );
}
