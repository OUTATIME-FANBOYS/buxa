'use client';

import { useActionState, useEffect, useState } from 'react';
import { HiddenField, TextField } from '@/components/atoms';
import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { fieldError, idle } from '@buxa/shared';
import { renameCampAction } from '@/actions/camp';
import { NAME_BUTTON, NAME_FIELD, NAME_FORM, NAME_SINGLE_FIELD, SETTINGS_TILE_HEADING } from './styles';

/**
 * Camp name: one input with the camp's current name and an Update button beside it. Update renames the camp through the
 * server action (org:update: owner and admin). The camp id travels in a hidden field, but the server checks it against the
 * person's memberships. A success shows a toast; a failure shows its message under the field, in small text.
 */
export function CampNameCard({ campId, currentName }: { campId: string; currentName: string }) {
  const [state, formAction, pending] = useActionState(renameCampAction, idle);
  const [name, setName] = useState(currentName);
  const { toast } = useUi();
  const done = state.status === 'success';

  useEffect(() => {
    if (done) {
      toast('Camp renamed');
    }
  }, [done, toast]);

  const formMessage = state.status === 'error' && !state.fieldErrors ? state.message : undefined;

  return (
    <section className="panel settings-tile" aria-labelledby="camp-name-title">
      <h2 id="camp-name-title" className={SETTINGS_TILE_HEADING}>
        Camp name
      </h2>
      <form className={`settings-name ${NAME_FORM}`} action={formAction}>
        <HiddenField name="campId" value={campId} />
        <TextField
          className={`settings-name__field ${NAME_FIELD} ${NAME_SINGLE_FIELD}`}
          label="Camp name"
          name="name"
          value={name}
          onChange={setName}
          error={fieldError(state, 'name')}
          maxLength={120}
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
