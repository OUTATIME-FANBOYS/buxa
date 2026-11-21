'use client';

import { useCallback, useState } from 'react';
import { FormPopUp } from '@/components/components';
import type { HouseholdChoice } from '@buxa/shared';
import { PersonForm } from './PersonForm';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';

const FORM_ID = 'new-person-form';

/**
 * The People page's Add person button. It opens the add form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. The page at /camp/people/new renders the same form.
 */
export function AddPersonButton({ households }: { households: readonly HouseholdChoice[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // A teacher stays in the pop-up after saving, to show the invite link; the form then cannot be saved a second time.
  const [stayed, setStayed] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // An added person closes the pop-up and toasts the server's message. A teacher keeps it open for the invite link.
  const saved = useCallback(
    (message: string, stay: boolean) => {
      toast(message);
      if (stay) {
        setStayed(true);
      } else {
        setOpen(false);
      }
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
          submitDisabled={stayed}
          onCancel={close}
          className="person-dialog"
          centred
        >
          <PersonForm
            mode="create"
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
