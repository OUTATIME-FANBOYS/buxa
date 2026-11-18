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
 * Name and email, one card with two rows (as Cloudflare's account settings). The display name row holds the first and last name
 * in inputs, with a small Update button beside them that saves to the signed-in account. The email row is read-only: it comes
 * from the sign-in, so it has no input and no button.
 */
export function NameEmailCard({
  firstName,
  lastName,
  email,
  className,
  onSaved,
}: {
  firstName: string;
  lastName: string | null;
  email: string;
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
    <section className={`panel settings-tile ${className ?? ''}`} id="profile" aria-labelledby="name-email-title">
      <h2 id="name-email-title">Name and email</h2>
      <form
        className="settings-row"
        aria-labelledby="display-name-label"
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <p id="display-name-label" className="settings-row__label">
          Display name
        </p>
        <div className="settings-name buxa:flex buxa:flex-wrap buxa:items-end">
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
        </div>
        {errors.form && (
          <p className="field-error" role="alert">
            {errors.form}
          </p>
        )}
      </form>
      <div className="settings-row" role="group" aria-labelledby="email-label">
        <p id="email-label" className="settings-row__label">
          Email
        </p>
        <p className="settings-row__value">{email || '—'}</p>
        <p className="muted settings-note">Your email comes from your sign-in and can’t be changed here.</p>
      </div>
    </section>
  );
}
