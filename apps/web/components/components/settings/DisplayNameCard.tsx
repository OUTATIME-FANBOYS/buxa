'use client';

import { useState } from 'react';
import { TextField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { updateProfileAction } from '@/actions/account';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { SETTINGS_TILE_HEADING } from './styles';

// The name inputs share a row with the Update button. The inputs take the free width; on a phone (under 600px) they stack
// first name, last name, then the button under them on the same left edge.
const NAME_FORM =
  'buxa:flex buxa:items-end buxa:gap-[var(--s3)] buxa:min-w-0 buxa:max-[599px]:flex-col buxa:max-[599px]:items-stretch';
const NAME_FIELDS =
  'buxa:flex-[1_1_0] buxa:min-w-0 buxa:grid buxa:grid-cols-[repeat(2,minmax(0,1fr))] buxa:gap-[var(--s3)] buxa:max-[599px]:grid-cols-[minmax(0,1fr)]';
const NAME_FIELD = 'buxa:flex buxa:flex-col buxa:gap-[var(--s2)] buxa:min-w-0';
// The Update button is as tall as the inputs, so it sits level with them on their bottom edge.
const NAME_BUTTON = 'buxa:flex-none buxa:h-[var(--control-h)]! buxa:whitespace-nowrap buxa:max-[599px]:self-start';

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
    // Only a success reaches here; the idle state of the action's result type is never returned after a save.
    if (saved.status !== 'success') {
      return;
    }
    setErrors({});
    toast(saved.message ?? 'Profile saved');
    onSaved({ firstName: first.trim(), lastName: last.trim() || null });
  };

  return (
    <section className={`panel settings-tile ${className ?? ''}`} aria-labelledby="display-name-title">
      <h2 id="display-name-title" className={SETTINGS_TILE_HEADING}>
        Display name
      </h2>
      <form
        className={`settings-name ${NAME_FORM}`}
        noValidate
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={`settings-name__fields ${NAME_FIELDS}`}>
          <TextField
            className={`settings-name__field ${NAME_FIELD}`}
            label="First name"
            error={errors.firstName}
            value={first}
            onChange={setFirst}
            maxLength={60}
            autoComplete="given-name"
          />
          <TextField
            className={`settings-name__field ${NAME_FIELD}`}
            label="Last name"
            error={errors.lastName}
            value={last}
            onChange={setLast}
            maxLength={60}
            autoComplete="family-name"
          />
        </div>
        <Button variant="secondary" size="sm" disabled={pending} className={NAME_BUTTON}>
          Update
        </Button>
      </form>
    </section>
  );
}
