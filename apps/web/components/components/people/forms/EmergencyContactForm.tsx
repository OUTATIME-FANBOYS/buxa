'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/elements';
import { HiddenField, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { updateEmergencyContactAction } from '@/actions/people';
import { FormMessage } from './FormMessage';

/** The values the person's emergency contact is edited from. Null fields are blank in the form. */
export interface EmergencyContactValues {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

/**
 * The emergency contact's edit form, opened from the person page. Blank name and phone clear the contact. It closes itself when the
 * save succeeds; the page then shows the saved values, because the action revalidates the person's page.
 */
export function EmergencyContactForm({
  personId,
  contact,
  onDone,
}: {
  personId: string;
  contact: EmergencyContactValues | null;
  /** Closes the form: after a save, or when cancelled. Must be stable (a callback in the parent). */
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateEmergencyContactAction, idle);
  const err = (name: string): string | undefined => fieldError(state, name);

  useEffect(() => {
    if (state.status === 'success') {
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="stack" aria-label="Edit emergency contact">
      <HiddenField name="id" value={personId} />
      <TextField
        label="Name"
        name="name"
        defaultValue={contact?.name ?? ''}
        error={err('name')}
        autoComplete="off"
        maxLength={120}
      />
      <TextField
        label="Phone"
        type="tel"
        name="phone"
        defaultValue={contact?.phone ?? ''}
        error={err('phone')}
        hint="Leave the name and phone blank to remove the contact."
        autoComplete="off"
        maxLength={32}
      />
      <TextField
        label="Relationship"
        name="relationship"
        defaultValue={contact?.relationship ?? ''}
        error={err('relationship')}
        autoComplete="off"
        maxLength={40}
      />
      <FormMessage state={state} />
      <div className="person-actions">
        <Button type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" icon="save" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
