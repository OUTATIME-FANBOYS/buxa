'use client';

import { useCallback, useState } from 'react';
import type { CustomField } from '@buxa/contracts';
import { Dialog } from '@/components/components/Dialog';
import { Button } from '@/components/elements';
import { RegisterForm } from './RegisterForm';

const FORM_ID = 'take-registration-form';

/**
 * The Take a registration button on a published form's page. It opens the family's registration form in a dialog, so the form's
 * page stays in view. Cancel and Record registration sit in the dialog's pinned footer, outside the scrolling body.
 */
export function TakeRegistrationButton({
  formId,
  sessions,
  fields,
}: {
  formId: string;
  sessions: readonly { id: string; name: string }[];
  fields: readonly CustomField[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button variant="glass" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Take a registration
      </Button>
      {open && (
        <Dialog
          title="Take a registration"
          onClose={close}
          className="class-dialog"
          footer={
            <>
              <Button variant="glass" type="button" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} variant="primary" disabled={pending}>
                {pending ? 'Recording...' : 'Record registration'}
              </Button>
            </>
          }
        >
          <RegisterForm
            formId={formId}
            id={FORM_ID}
            variant="dialog"
            sessions={sessions}
            fields={fields}
            onPendingChange={setPending}
          />
        </Dialog>
      )}
    </>
  );
}
