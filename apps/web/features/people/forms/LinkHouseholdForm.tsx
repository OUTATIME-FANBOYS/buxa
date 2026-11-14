'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Field } from '@/components/ui';
import { fieldError, idle } from '@/lib/actions/state';
import { linkHouseholdAction } from '../actions';
import { FormMessage } from './FormMessage';

export interface PersonOption { id: string; name: string }
export interface HouseholdOption { id: string; name: string }

/** Link one of the matching people to a household. A child's collector must be a guardian (the form says so; the server enforces it). */
export function LinkHouseholdForm({ households, people }: { households: readonly HouseholdOption[]; people: readonly PersonOption[] }) {
  const [state, formAction, pending] = useActionState(linkHouseholdAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="stack">
      <div className="people-form-grid">
        <Field label="Household" error={err('householdId')}>
          <select name="householdId" aria-invalid={err('householdId') ? true : undefined} defaultValue={households[0]?.id}>
            {households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        <Field label="Person" error={err('personId')}>
          <select name="personId" aria-invalid={err('personId') ? true : undefined} defaultValue="">
            <option value="" disabled>Choose a person</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="How they are related" error={err('relationship')}>
          <input name="relationship" maxLength={40} autoComplete="off" aria-invalid={err('relationship') ? true : undefined} />
        </Field>
      </div>
      <div className="people-checks">
        <label className="people-check"><input type="checkbox" name="isGuardian" /> Parent or guardian</label>
        <label className="people-check"><input type="checkbox" name="canPickup" /> May collect the child (guardians only)</label>
      </div>
      {err('canPickup') && <p className="field-error" role="alert">{err('canPickup')}</p>}
      <FormMessage state={state} />
      <div><button className="btn" disabled={pending}>{pending ? 'Linking…' : 'Link to household'}</button></div>
    </form>
  );
}
