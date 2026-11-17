'use client';

import { useCallback, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import type { HouseholdChoice } from '@buxa/shared';
import { NewPersonForm } from './NewPersonForm';

/**
 * The People page's Add person button. It opens the add form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. The page at /camp/people/new still renders the same form.
 */
export function AddPersonButton({ households }: { households: readonly HouseholdChoice[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>Add person</button>
      {open && (
        <Dialog title="Add person" onClose={close} className="person-dialog">
          <p className="person-helper">A child must join a household that has a parent or guardian in it.</p>
          <NewPersonForm variant="dialog" household={null} households={households} onCancel={close} />
        </Dialog>
      )}
    </>
  );
}
