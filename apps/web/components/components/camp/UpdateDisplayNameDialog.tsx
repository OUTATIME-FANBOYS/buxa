'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components/export';
import { Button } from '@/components/elements/export';
import { TextField } from '@/components/atoms';
import { updateProfileAction } from '@/actions/account';

/** The first and last name the person saved, as the server returns them. */
export interface SavedName {
  firstName: string;
  lastName: string | null;
}

/**
 * Update display name: the first name (required) and the last name, saved to the signed-in account. The title stays on this
 * device's board copy, as it always has. Email is not editable here.
 */
export function UpdateDisplayNameDialog({
  firstName,
  lastName,
  title,
  onClose,
  onSaved,
}: {
  firstName: string;
  lastName: string | null;
  title: string;
  onClose: () => void;
  onSaved: (saved: SavedName, title: string) => void;
}) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName ?? '');
  const [role, setRole] = useState(title);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const saved = await updateProfileAction({ firstName: first, lastName: last });
    setPending(false);
    if (saved.status === 'error') {
      setErrors({
        firstName: saved.fieldErrors?.firstName,
        lastName: saved.fieldErrors?.lastName,
        form: saved.fieldErrors ? undefined : saved.message,
      });

      return;
    }
    onSaved({ firstName: first.trim(), lastName: last.trim() || null }, role);
    onClose();
  };

  return (
    <Dialog title="Update display name" onClose={onClose} labelledBy="update-display-name-title">
      <form
        className="stack"
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="First name"
          error={errors.firstName}
          value={first}
          onChange={setFirst}
          maxLength={60}
          autoComplete="given-name"
        />
        <TextField
          label="Last name"
          hint="Optional."
          error={errors.lastName}
          value={last}
          onChange={setLast}
          maxLength={60}
          autoComplete="family-name"
        />
        <TextField label="Role or title" value={role} onChange={setRole} maxLength={60} />
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="row">
          <Button variant="primary" icon="save" disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
