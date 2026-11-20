'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import type { HouseholdChoice } from '@buxa/shared';
import { NewPersonForm } from './NewPersonForm';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';

const FORM_ID = 'new-person-form';

/**
 * The People page's Add person button. It opens the add form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. The page at /camp/people/new still renders the same form.
 */
export function AddPersonButton({ households }: { households: readonly HouseholdChoice[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // An added person closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button variant="primary" type="button" icon="user-plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add person
      </Button>
      {open && (
        <FormPopUp
          title="Add person"
          formId={FORM_ID}
          submitLabel="Add person"
          pendingLabel="Adding…"
          submitIcon="plus"
          pending={pending}
          onCancel={close}
          className="person-dialog"
        >
          <NewPersonForm
            variant="dialog"
            formId={FORM_ID}
            household={null}
            households={households}
            onPendingChange={setPending}
            onSaved={saved}
          />
        </FormPopUp>
      )}
    </>
  );
}
