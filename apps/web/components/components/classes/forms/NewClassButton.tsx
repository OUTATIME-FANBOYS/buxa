'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { NewClassForm } from './NewClassForm';
import { Button } from '@/components/elements/export';

/**
 * The Classes page's New class button. It opens the create form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. The page at /camp/classes/new still renders the same form.
 */
export function NewClassButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="primary" type="button" className="classes-target" aria-haspopup="dialog" onClick={() => setOpen(true)}>New class</Button>
      {open && (
        <Dialog title="New class" onClose={close} className="class-dialog">
          <NewClassForm variant="dialog" onCancel={close} />
        </Dialog>
      )}
    </>
  );
}
