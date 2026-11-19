'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { Checkbox, Select, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { linkHouseholdAction } from '@/actions/people';
import { FormMessage } from './FormMessage';

export interface PersonOption {
  id: string;
  name: string;
}
export interface HouseholdOption {
  id: string;
  name: string;
}

/**
 * Link one of the matching people to a household. A child's collector must be a guardian (the form says so; the server enforces it).
 * The pick-up checkbox appears only for admins and above: the server refuses it from anyone else.
 */
export function LinkHouseholdForm({
  households,
  people,
  canAuthorisePickup,
}: {
  households: readonly HouseholdOption[];
  people: readonly PersonOption[];
  canAuthorisePickup: boolean;
}) {
  const [state, formAction, pending] = useActionState(linkHouseholdAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="stack">
      <div className="people-form-grid">
        <Select
          label="Household"
          name="householdId"
          error={err('householdId')}
          defaultValue={households[0]?.id}
          options={households.map(h => ({ value: h.id, label: h.name }))}
        />
        <Select
          label="Person"
          name="personId"
          error={err('personId')}
          placeholder="Choose a person"
          options={people.map(p => ({ value: p.id, label: p.name }))}
        />
        <TextField
          label="How they are related"
          name="relationship"
          error={err('relationship')}
          maxLength={40}
          autoComplete="off"
        />
      </div>
      <div className="people-checks">
        <Checkbox className="people-check" name="isGuardian">
          Parent or guardian
        </Checkbox>
        {canAuthorisePickup && (
          <Checkbox className="people-check" name="canPickup">
            May collect the child (guardians only)
          </Checkbox>
        )}
      </div>
      {err('canPickup') && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {err('canPickup')}
        </p>
      )}
      <FormMessage state={state} />
      <div>
        <Button icon="unlink" disabled={pending}>
          {pending ? 'Linking…' : 'Link to household'}
        </Button>
      </div>
    </form>
  );
}
