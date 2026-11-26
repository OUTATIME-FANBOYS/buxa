'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormPopUp } from '@/components/components';
import type { HouseholdChoice } from '@buxa/shared';
import { PersonForm } from './PersonForm';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { ROUTES } from '@/config/routes';

const FORM_ID = 'new-person-form';

/**
 * The People page's Add person button. It opens the add form in a dialog, so the list stays in view; the dialog closes on Escape,
 * the close button or Cancel, and focus returns to this button. `initialOpen` opens it from the address (?add=person), and
 * `householdId` (from a family's page) joins the new person to that household.
 */
export function AddPersonButton({
  households,
  initialOpen = false,
  householdId,
}: {
  households: readonly HouseholdChoice[];
  initialOpen?: boolean;
  householdId?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [pending, setPending] = useState(false);
  // A teacher stays in the pop-up after saving, to show the invite link; the form then cannot be saved a second time.
  const [stayed, setStayed] = useState(false);
  const { toast } = useUi();
  const router = useRouter();
  // Opened from the address, closing clears it, so a reload does not open the pop-up again.
  const close = useCallback(() => {
    setOpen(false);
    if (initialOpen) {
      router.replace(ROUTES.people);
    }
  }, [initialOpen, router]);
  // An added person closes the pop-up and toasts the server's message. A teacher keeps it open for the invite link.
  const saved = useCallback(
    (message: string, stay: boolean) => {
      toast(message);
      if (stay) {
        setStayed(true);
      } else {
        close();
      }
    },
    [toast, close],
  );
  // A family's page joins the person to its household, so the household picker is not needed.
  const joining = householdId === undefined ? undefined : households.find(choice => choice.id === householdId);

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
        >
          <PersonForm
            mode="create"
            variant="dialog"
            formId={FORM_ID}
            household={joining ? { id: joining.id, name: joining.name } : null}
            households={joining ? [] : households}
            onPendingChange={setPending}
            onSaved={saved}
          />
        </FormPopUp>
      )}
    </>
  );
}
