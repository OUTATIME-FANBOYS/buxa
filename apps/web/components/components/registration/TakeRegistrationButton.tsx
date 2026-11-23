'use client';

import { useCallback, useState } from 'react';
import type { ClockFormat, CustomField } from '@buxa/contracts';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { RegisterForm, type RegisterCamper, type RegisterSession } from './RegisterForm';

const FORM_ID = 'take-registration-form';

/**
 * The Take a registration button on a published form's page. It opens the family's registration form in a dialog, so the form's
 * page stays in view. Cancel and Record registration sit in the dialog's pinned footer, outside the scrolling body.
 */
export function TakeRegistrationButton({
  formId,
  sessions,
  campers,
  timeZone,
  clockFormat,
  fields,
}: {
  formId: string;
  sessions: readonly RegisterSession[];
  campers: readonly RegisterCamper[];
  timeZone: string;
  clockFormat: ClockFormat;
  fields: readonly CustomField[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // A saved form closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button variant="glass" icon="plus" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Take a registration
      </Button>
      {open && (
        <FormPopUp
          title="Take a registration"
          formId={FORM_ID}
          submitLabel="Record registration"
          pendingLabel="Recording..."
          submitIcon="plus"
          pending={pending}
          onCancel={close}
        >
          <RegisterForm
            formId={formId}
            id={FORM_ID}
            variant="dialog"
            sessions={sessions}
            campers={campers}
            timeZone={timeZone}
            clockFormat={clockFormat}
            fields={fields}
            onPendingChange={setPending}
            onSaved={saved}
          />
        </FormPopUp>
      )}
    </>
  );
}
