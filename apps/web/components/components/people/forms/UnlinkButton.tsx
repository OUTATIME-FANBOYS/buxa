'use client';

import { useActionState } from 'react';
import { idle } from '@buxa/shared';
import { unlinkHouseholdAction } from '@/actions/people';
import { FormMessage } from './FormMessage';
import { Button } from '@/components/elements/export';

/** Take someone out of a household. Its result is shown beside the member, so a refused removal (a child's last guardian) explains itself. */
export function UnlinkButton({ householdId, personId, name }: { householdId: string; personId: string; name: string }) {
  const [state, formAction, pending] = useActionState(unlinkHouseholdAction, idle);

  return (
    <form action={formAction} className="people-inline">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="personId" value={personId} />
      <Button variant="danger-ghost" size="sm" disabled={pending} aria-label={`Remove ${name} from this household`}>
        {pending ? 'Removing…' : 'Remove'}
      </Button>
      {state.status === 'error' && <FormMessage state={state} />}
    </form>
  );
}
