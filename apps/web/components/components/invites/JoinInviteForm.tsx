'use client';

import { useActionState, useState } from 'react';
import { Button, TextField } from '@/components/elements';
import { HiddenField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { joinInviteAction } from '@/actions/invites';

export interface JoinDefaults {
  firstName: string;
  lastName: string;
  phone: string;
}

/**
 * The profile a teacher confirms before joining. Pre-filled from the invite; the teacher corrects it. First name is required,
 * last name and phone are optional. The server saves it to the signed-in person's own row, then joins them to the camp.
 */
export function JoinInviteForm({ token, defaults }: { token: string; defaults: JoinDefaults }) {
  const [state, action, pending] = useActionState(joinInviteAction, idle);
  const [values, setValues] = useState(defaults);
  const bind = (field: keyof JoinDefaults) => ({
    value: values[field],
    onChange: (value: string) => setValues(previous => ({ ...previous, [field]: value })),
  });

  return (
    <form action={action} noValidate className="buxa:grid buxa:gap-4">
      <HiddenField name="token" value={token} />
      <TextField
        label="First name"
        name="firstName"
        isRequired
        autoComplete="given-name"
        error={fieldError(state, 'firstName')}
        maxLength={60}
        autoFocus
        {...bind('firstName')}
      />
      <TextField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        error={fieldError(state, 'lastName')}
        maxLength={60}
        {...bind('lastName')}
      />
      <TextField
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        hint="Optional"
        error={fieldError(state, 'phone')}
        maxLength={32}
        {...bind('phone')}
      />
      {state.status === 'error' && !state.fieldErrors && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {state.message}
        </p>
      )}
      <Button variant="primary" fullWidth type="submit" icon="check" disabled={pending}>
        {pending ? 'Joining…' : 'Join the camp'}
      </Button>
    </form>
  );
}
