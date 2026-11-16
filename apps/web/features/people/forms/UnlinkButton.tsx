'use client';

import { useActionState } from 'react';
import { idle } from '@/lib/actions/state';
import { unlinkHouseholdAction } from '../actions';
import { FormMessage } from './FormMessage';

/** Take someone out of a household. Its result is shown beside the member, so a refused removal (a child's last guardian) explains itself. */
export function UnlinkButton({ householdId, personId, name }: { householdId: string; personId: string; name: string }) {
  const [state, formAction, pending] = useActionState(unlinkHouseholdAction, idle);
  return (
    <form action={formAction} className="people-inline">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="personId" value={personId} />
      <button className="btn btn-sm btn-ghost btn-danger-ghost" disabled={pending} aria-label={`Remove ${name} from this household`}>
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {state.status === 'error' && <FormMessage state={state} />}
    </form>
  );
}
