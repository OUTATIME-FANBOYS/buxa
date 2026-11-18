'use client';

import { useState } from 'react';
import { TextField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { updateProfileAction } from '@/actions/account';
import { useUi } from '@buxa/middleware/providers/UiProvider';

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
  const { toast } = useUi();
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const saved = await updateProfileAction({ firstName: first, lastName: last });
    setPending(false);
    if (saved.status === 'error') {
      // Field problems show under their input; anything else shows in the same popup as a successful save.
      setErrors({ firstName: saved.fieldErrors?.firstName, lastName: saved.fieldErrors?.lastName });
      if (!saved.fieldErrors) {
        toast(saved.message, { tone: 'error' });
      }

      return;
    }
    setErrors({});
    toast(saved.message);
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
      </form>
    </section>
  );
}
