'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { NewClassForm } from './NewClassForm';

/**
 * The Classes page's New class button. It opens the create form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. The page at /camp/classes/new still renders the same form.
 */
export function NewClassButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="btn btn-primary classes-target" aria-haspopup="dialog" onClick={() => setOpen(true)}>New class</button>
      {open && (
        <Dialog title="New class" onClose={close} className="class-dialog">
          <NewClassForm variant="dialog" onCancel={close} />
        </Dialog>
      )}
    </>
  );
}
