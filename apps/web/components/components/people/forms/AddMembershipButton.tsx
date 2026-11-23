'use client';

import { useCallback, useState } from 'react';
import type { Session } from '@buxa/contracts';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { AddMembershipForm } from './AddMembershipForm';

const FORM_ID = 'add-membership-form';

/**
 * The membership card's Add membership button. It opens the form in a pop-up, as Add person does. Saving closes the pop-up and
 * toasts the server's message; Cancel, Escape and the close button close it without saving.
 */
export function AddMembershipButton({ personId, sessions }: { personId: string; sessions: readonly Session[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button variant="secondary" type="button" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add membership
      </Button>
      {open && (
        <FormPopUp
          title="Add membership"
          formId={FORM_ID}
          submitLabel="Add membership"
          pendingLabel="Adding…"
          submitIcon="plus"
          pending={pending}
          onCancel={close}
        >
          <AddMembershipForm
            personId={personId}
            sessions={sessions}
            formId={FORM_ID}
            onPendingChange={setPending}
            onSaved={saved}
          />
        </FormPopUp>
      )}
    </>
  );
}
