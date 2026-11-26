'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/elements';
import { RegistrationFormDialog } from './RegistrationFormDialog';

/** The New Form button on the registration list. It opens the create pop-up, so the list stays in view. */
export function NewRegistrationFormButton({ sessions }: { sessions: readonly { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="primary" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        New Form
      </Button>
      {open && <RegistrationFormDialog mode="create" sessions={sessions} onClose={close} />}
    </>
  );
}
