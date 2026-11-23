'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { CUSTOM_SESSION_CHOICE, type Session } from '@buxa/contracts';
import { DatePicker, HiddenField, Select, TextField } from '@/components/atoms';
import { fieldError, formatLocalDate, idle } from '@buxa/shared';
import { addMembershipAction } from '@/actions/people';
import { FormMessage } from './FormMessage';

type DatedSession = Session & { startsOn: string; endsOn: string };

interface AddMembershipFormProps {
  personId: string;
  /** The camp's sessions. A session with no dates yet cannot be chosen. */
  sessions: readonly Session[];
  /** The id of the <form>. The pop-up's footer submits it by this id. */
  formId: string;
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the membership is saved. The pop-up closes and toasts it. */
  onSaved?: (message: string) => void;
}

/**
 * A new membership, from a camp session or typed as a custom one. The Session choice comes first. A session copies its name and
 * dates (shown under the choice) and the membership keeps its id. Custom shows the Name and the two dates instead.
 */
export function AddMembershipForm({ personId, sessions, formId, onPendingChange, onSaved }: AddMembershipFormProps) {
  const [state, formAction, pending] = useActionState(addMembershipAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const [choice, setChoice] = useState('');
  const dated = useMemo(
    () => sessions.filter((session): session is DatedSession => session.startsOn !== null && session.endsOn !== null),
    [sessions],
  );
  const chosen = dated.find(session => session.id === choice) ?? null;
  const isCustom = choice === CUSTOM_SESSION_CHOICE;
  const err = (name: string) => fieldError(state, name);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);
  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Membership added.');
    }
  }, [state, onSaved]);

  const options = [
    ...dated.map(session => ({ value: session.id, label: session.name })),
    { value: CUSTOM_SESSION_CHOICE, label: 'Custom' },
  ];

  return (
    <form id={formId} ref={formRef} action={formAction} className="stack">
      <HiddenField name="personId" value={personId} />
      {/* Every field has the same parts in the same order: label, input, helper line. */}
      <div className="people-form-grid people-membership-fields">
        <Select
          label="Session"
          name="sessionId"
          options={options}
          value={choice}
          onChange={value => setChoice(value ?? '')}
          placeholder="Choose a session"
          isRequired
          error={err('sessionId')}
          hint={chosen ? `${formatLocalDate(chosen.startsOn)} to ${formatLocalDate(chosen.endsOn)}` : undefined}
        />
        {chosen && (
          <>
            <HiddenField name="plan" value={chosen.name} />
            <HiddenField name="startsOn" value={chosen.startsOn} />
            <HiddenField name="endsOn" value={chosen.endsOn} />
          </>
        )}
        {isCustom && (
          <>
            <TextField
              label="Name"
              name="plan"
              isRequired
              error={err('plan')}
              hint='For example "Summer 2027".'
              maxLength={80}
              autoComplete="off"
            />
            <DatePicker
              label="Starts on"
              name="startsOn"
              isRequired
              error={err('startsOn')}
              hint="The first camp day, included."
            />
            <DatePicker
              label="Ends on"
              name="endsOn"
              isRequired
              error={err('endsOn')}
              hint="The last camp day, included."
            />
          </>
        )}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
