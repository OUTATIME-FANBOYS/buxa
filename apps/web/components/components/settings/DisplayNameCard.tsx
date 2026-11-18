'use client';

import { useState } from 'react';
import { TextField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { updateProfileAction } from '@/actions/account';

/** The name the person saved, as the server returns it. */
export interface SavedName {
  firstName: string;
  lastName: string | null;
}

/**
 * Display name: the first and last name in two inputs, with one Update button that saves them to the signed-in account.
 */
export function DisplayNameCard({
  firstName,
  lastName,
  className,
  onSaved,
}: {
  firstName: string;
  lastName: string | null;
  className?: string;
  onSaved: (saved: SavedName) => void;
}) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName ?? '');
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
    setErrors({});
    onSaved({ firstName: first.trim(), lastName: last.trim() || null });
  };

  return (
    <section className={`panel settings-tile ${className ?? ''}`} aria-labelledby="display-name-title">
      <h2 id="display-name-title">Display name</h2>
      <form
        className="settings-name"
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="settings-name__fields">
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
            error={errors.lastName}
            value={last}
            onChange={setLast}
            maxLength={60}
            autoComplete="family-name"
          />
        </div>
        <Button variant="secondary" size="sm" disabled={pending}>
          Update
        </Button>
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
      </form>
    </section>
  );
}
