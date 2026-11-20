'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { FormPopUp } from '@/components/components/FormPopUp';
import { Button, Field, TextField } from '@/components/elements';
import type { FieldErrors } from '@buxa/shared';
import { createTeacherInviteAction, resendTeacherInviteAction } from '@/actions/invites';

const FORM_ID = 'add-teacher';

type InviteSendResult = Awaited<ReturnType<typeof createTeacherInviteAction>>;

export interface InviteValues {
  name: string;
  email: string;
  phone: string;
}
export type InviteFieldErrors = Partial<Record<keyof InviteValues, string>>;

/** The three fields. Name and email are required (one red asterisk each); phone is optional. */
export function TeacherInviteFields({
  values,
  errors,
  onChange,
}: {
  values: InviteValues;
  errors: InviteFieldErrors;
  onChange: (field: keyof InviteValues, value: string) => void;
}) {
  return (
    <>
      <TextField
        label="Name"
        name="name"
        isRequired
        value={values.name}
        onChange={value => onChange('name', value)}
        error={errors.name}
        maxLength={120}
        autoFocus
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        isRequired
        autoComplete="email"
        inputMode="email"
        value={values.email}
        onChange={value => onChange('email', value)}
        error={errors.email}
        maxLength={254}
      />
      <TextField
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={values.phone}
        onChange={value => onChange('phone', value)}
        error={errors.phone}
        hint="Optional"
        maxLength={32}
      />
    </>
  );
}

/** Where the flow is: typing the form (with the last message, if any), or an invite was sent and its link is shown. */
type InviteFlow =
  | { phase: 'editing'; message?: string; errors: InviteFieldErrors }
  | { phase: 'sent'; inviteId: string; email: string; link: string };

const NO_ERRORS: InviteFieldErrors = {};

function toFieldErrors(fieldErrors: FieldErrors | undefined): InviteFieldErrors {
  if (!fieldErrors) {
    return NO_ERRORS;
  }

  return { name: fieldErrors.name, email: fieldErrors.email, phone: fieldErrors.phone };
}

/**
 * Add a teacher. Staff, admins and owners fill in the name, email and phone; "Send invite" creates the invite and shows its
 * link here. The link is shown only in this pop-up, once per send: "Send again" makes a new link and the old one stops working.
 */
export function AddTeacherDialog({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState<InviteValues>({ name: '', email: '', phone: '' });
  const [flow, setFlow] = useState<InviteFlow>({ phase: 'editing', errors: NO_ERRORS });
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const linkRef = useRef<HTMLInputElement>(null);

  const change = (field: keyof InviteValues, value: string) => setValues(previous => ({ ...previous, [field]: value }));

  const apply = (result: InviteSendResult) => {
    if (result.status === 'sent') {
      setCopied(false);
      setFlow({ phase: 'sent', inviteId: result.inviteId, email: result.email, link: result.link });

      return;
    }
    setFlow({ phase: 'editing', message: result.message, errors: toFieldErrors(result.fieldErrors) });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result =
          flow.phase === 'sent'
            ? await resendTeacherInviteAction(flow.inviteId)
            : await createTeacherInviteAction(values);
        apply(result);
      } catch {
        apply({ status: 'error', message: 'Could not send the invite. Try again.' });
      }
    });
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // No clipboard access here: select the link so it can be copied by hand.
      linkRef.current?.select();
    }
  };

  const sent = flow.phase === 'sent';

  return (
    <FormPopUp
      title="Add a teacher"
      formId={FORM_ID}
      submitLabel={sent ? 'Send again' : 'Send invite'}
      pendingLabel="Sending…"
      submitIcon="send"
      pending={pending}
      onCancel={onClose}
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate>
        {flow.phase === 'sent' ? (
          <div className="buxa:grid buxa:gap-4">
            <p role="status">{`Invite sent to ${flow.email}. In this build the email is shown here, not sent.`}</p>
            <Field label="Invite link">
              <input
                ref={linkRef}
                readOnly
                value={flow.link}
                onFocus={event => event.currentTarget.select()}
                className="buxa:box-border buxa:h-[var(--control-h)] buxa:w-full buxa:min-w-0 buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-[var(--surface)] buxa:px-3 buxa:font-[inherit] buxa:text-[var(--text)]"
              />
            </Field>
            <div>
              <Button type="button" variant="glass" icon="copy" onClick={() => void copyLink(flow.link)}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="buxa:grid buxa:gap-4">
            <TeacherInviteFields values={values} errors={flow.errors} onChange={change} />
            {flow.message && (
              <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
                {flow.message}
              </p>
            )}
          </div>
        )}
      </form>
    </FormPopUp>
  );
}
