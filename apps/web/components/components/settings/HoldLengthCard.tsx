'use client';

import { useActionState, useEffect, useState } from 'react';
import { HiddenField, TextField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { fieldError, idle } from '@buxa/shared';
import { setHoldLengthAction } from '@/actions/camp';
import { NAME_BUTTON, NAME_FIELD, NAME_FORM, NAME_SINGLE_FIELD, SETTINGS_TILE_HEADING } from './styles';

/**
 * Seat hold length: one input with the camp's current length (empty means the default, 15) and an Update button beside it.
 * Update saves it through the server action (org:update: owner and admin). The camp id travels in a hidden field, but the
 * server checks it against the person's memberships. A success shows a toast; a refusal shows its message under the field, in
 * small text.
 */
export function HoldLengthCard({ campId, currentMinutes }: { campId: string; currentMinutes: number | null }) {
  const [state, formAction, pending] = useActionState(setHoldLengthAction, idle);
  const [minutes, setMinutes] = useState(currentMinutes === null ? '' : String(currentMinutes));
  const { toast } = useUi();
  const done = state.status === 'success';

  useEffect(() => {
    if (done) {
      toast('Seat hold length saved');
    }
  }, [done, toast]);

  const formMessage = state.status === 'error' && !state.fieldErrors ? state.message : undefined;

  return (
    <section className="panel settings-tile" aria-labelledby="hold-length-title">
      <h2 id="hold-length-title" className={SETTINGS_TILE_HEADING}>
        Seat hold length
      </h2>
      <form className={`settings-name ${NAME_FORM}`} action={formAction}>
        <HiddenField name="campId" value={campId} />
        <TextField
          className={`settings-name__field ${NAME_FIELD} ${NAME_SINGLE_FIELD}`}
          label="Seat hold length (minutes)"
          name="holdMinutes"
          value={minutes}
          onChange={setMinutes}
          error={fieldError(state, 'holdMinutes')}
          hint="How long a family's place is held while they finish registering. Between 5 and 60 minutes. Holds already placed keep their time."
          inputMode="numeric"
          maxLength={2}
        />
        <Button type="submit" variant="glass" disabled={pending} className={NAME_BUTTON}>
          Update
        </Button>
      </form>
      {formMessage && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {formMessage}
        </p>
      )}
    </section>
  );
}
