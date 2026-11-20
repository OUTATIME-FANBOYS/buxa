'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { fieldError, idle } from '@buxa/shared';
import type { SessionPrice } from '@buxa/domain';
import { setSessionPriceAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { PriceFields } from './PriceFields';

/**
 * The session page's price button. It opens a dialog with the price fields; saving changes the session's price (and every class
 * in it shows that price). The dialog closes on save, Escape, the close button or Cancel.
 */
export function SessionPriceButton({ sessionId, price }: { sessionId: string; price: SessionPrice | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button type="button" variant="glass" size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {price ? 'Change price' : 'Set price'}
      </Button>
      {open && (
        <FormPopUp
          title="Session price"
          formId={FORM_ID}
          submitLabel="Save price"
          pendingLabel="Saving..."
          pending={pending}
          onCancel={close}
        >
          <SessionPriceForm
            sessionId={sessionId}
            price={price}
            formId={FORM_ID}
            onSaved={close}
            onPendingChange={setPending}
          />
        </FormPopUp>
      )}
    </>
  );
}

const FORM_ID = 'session-price-form';

function SessionPriceForm({
  sessionId,
  price,
  formId,
  onSaved,
  onPendingChange,
}: {
  sessionId: string;
  price: SessionPrice | null;
  formId: string;
  onSaved: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(setSessionPriceAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved();
    }
  }, [state, onSaved]);
  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} id={formId} action={formAction} className="class-form session-form">
      <input type="hidden" name="sessionId" value={sessionId} />
      <p className="class-helper">
        Leave the price blank to show no price. Each class in the session shows this price.
      </p>
      <PriceFields price={price} error={err} />
      <ActionMessage state={state} />
    </form>
  );
}
