'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { NewSessionForm } from './NewSessionForm';
import { Button } from '@/components/elements';

/**
 * The Sessions page's New session button. It opens the create form in a dialog, so the list stays in view; the dialog closes on
 * Escape, the close button or Cancel, and focus returns to this button.
 */
export function NewSessionButton() {
  const [open, setOpen] = useState(false);
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
        <Dialog title="New session" onClose={close} className="class-dialog">
          <NewSessionForm variant="dialog" onCancel={close} />
        </Dialog>
      )}
    </>
  );
}
