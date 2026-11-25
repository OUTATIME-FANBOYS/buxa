'use client';

import { useCallback, useState } from 'react';
import type { RegistrationForm } from '@buxa/contracts';
import { Button } from '@/components/elements';
import { RegistrationFormDialog } from './RegistrationFormDialog';

/** Edit form on a form's page. It opens the edit pop-up; the page shows it only to staff with registration:manage. */
export function EditFormButton({
  form,
  sessions,
}: {
  form: RegistrationForm;
  sessions: readonly { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Edit form
      </Button>
      {open && <RegistrationFormDialog mode="edit" form={form} sessions={sessions} onClose={close} />}
    </>
  );
}
