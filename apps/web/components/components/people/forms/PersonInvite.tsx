'use client';

import { useEffect, useState } from 'react';
import { InviteTeacherInputSchema } from '@buxa/contracts';
import { Button, Field } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { createTeacherInviteAction } from '@/actions/invites';

export interface PersonInviteDetails {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}

/**
 * The first message the invite contract gives for these details, or undefined when they are all valid. It is the server's schema, so
 * the words are the person form's: a blank phone or date of birth gets the same message as on the person form.
 */
export function inviteProblem(details: PersonInviteDetails): string | undefined {
  const checked = InviteTeacherInputSchema.safeParse(details);

  return checked.success ? undefined : (checked.error.issues[0]?.message ?? 'Check the invite details.');
}

/** The person's name, email and phone as the form holds them now. The invite is sent with what is typed. */
export function personInviteDetails(form: HTMLFormElement | null): PersonInviteDetails {
  const data = new FormData(form ?? undefined);
  const field = (name: string) => {
    const value = data.get(name);

    return typeof value === 'string' ? value : '';
  };

  return {
    name: `${field('givenName')} ${field('familyName')}`.trim(),
    email: field('email'),
    phone: field('phone'),
    dateOfBirth: field('dateOfBirth'),
  };
}

/**
 * The invite button beside a person's Email field. It sends the same teacher invite as the rest of the app (createTeacherInviteAction)
 * and shows the link once, in the pop-up or form it sits in, with a toast that says "Invite sent". "Resend invite" (on an existing
 * person) sends a new invite the same way. The link is never stored by the page.
 */
export function PersonInvite({
  label,
  readDetails,
  autoSend = false,
  disabled = false,
}: {
  label: 'Send invite' | 'Resend invite';
  readDetails: () => PersonInviteDetails;
  /** Sends once as it mounts (the teacher invite after a person is saved), so the link appears without another click. */
  autoSend?: boolean;
  /** Off until the person's email is a valid address. */
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useUi();

  const send = async () => {
    const details = readDetails();
    // The details are checked here first, so a missing phone or date of birth is named without a round trip.
    const problem = inviteProblem(details);
    if (problem) {
      setMessage(problem);

      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await createTeacherInviteAction(details);
      if (result.status === 'sent') {
        setSent({ email: result.email, link: result.link });
        setCopied(false);
        toast('Invite sent');
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage('Could not send the invite. Try again.');
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (autoSend) {
      void send();
    }
    // Only on mount: the invite is sent once for the saved person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="buxa:contents">
      <Button type="button" variant="secondary" icon="send" disabled={pending || disabled} onClick={() => void send()}>
        {pending ? 'Sending…' : label}
      </Button>
      {message && (
        <p className="field-error buxa:basis-full buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {message}
        </p>
      )}
      {sent && (
        <div className="buxa:grid buxa:basis-full buxa:gap-2 buxa:text-center" role="status">
          <p className="buxa:m-0 buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-2)]">
            {`Invite sent to ${sent.email}. This link is shown once; the old link stops working when you send again.`}
          </p>
          <Field label="Invite link">
            <input
              readOnly
              value={sent.link}
              onFocus={event => event.currentTarget.select()}
              className="buxa:box-border buxa:h-[var(--control-h)] buxa:w-full buxa:min-w-0 buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-[var(--surface)] buxa:px-3 buxa:font-[inherit] buxa:text-[var(--text)]"
            />
          </Field>
          <div className="buxa:flex buxa:justify-center">
            <Button type="button" variant="glass" icon="copy" onClick={() => void copy(sent.link)}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The invite button for a role that cannot be invited yet (only teachers can be invited in this build). It is shown disabled, with the
 * note, so the form says what will come.
 */
export function ComingSoonInvite({ label }: { label: 'Send invite' | 'Resend invite' }) {
  return (
    <div className="buxa:contents">
      <Button type="button" variant="secondary" icon="send" disabled>
        {label}
      </Button>
      <p className="muted buxa:basis-full buxa:m-0 buxa:text-center buxa:text-[length:var(--fs-s)]">
        Invites for this role are coming soon.
      </p>
    </div>
  );
}
