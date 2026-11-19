'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import type { Class } from '@buxa/contracts';
import { ClassForm, type InstructorChoice } from './ClassForm';

/**
 * Opens a class's edit form in a dialog. The button is an icon with an accessible name and a tooltip. The dialog closes when the
 * change is saved, on Cancel, or on Escape.
 */
export function EditClassButton({
  cls,
  sessionName,
  timeZone,
  instructors,
}: {
  cls: Class;
  sessionName: string;
  timeZone: string;
  instructors: readonly InstructorChoice[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        icon="edit"
        aria-label={`Edit ${cls.name}`}
        title="Edit class"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <Dialog title="Edit class" onClose={close} className="class-dialog">
          <ClassForm
            sessionId={cls.sessionId}
            sessionName={sessionName}
            timeZone={timeZone}
            instructors={instructors}
            cls={cls}
            variant="dialog"
            onCancel={close}
            onSaved={close}
          />
        </Dialog>
      )}
    </>
  );
}
