'use client';

import { useActionState, useId } from 'react';
import { idle } from '@buxa/shared';
import { setSessionPublicAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

/**
 * The session page's "show on the public pages" tick box. Ticking it submits the form at once, so there is no separate Save.
 * The server checks classes:manage; a viewer never sees this control.
 */
export function SessionPublicToggle({ sessionId, isPublic }: { sessionId: string; isPublic: boolean }) {
  const [state, formAction, pending] = useActionState(setSessionPublicAction, idle);
  const id = useId();

  return (
    <form action={formAction} className="session-public">
      <input type="hidden" name="sessionId" value={sessionId} />
      <label htmlFor={id} className="session-public-label">
        <input
          id={id}
          type="checkbox"
          name="isPublic"
          defaultChecked={isPublic}
          disabled={pending}
          onChange={event => event.currentTarget.form?.requestSubmit()}
        />
        Show this session on the public pages
      </label>
      <ActionMessage state={state} />
    </form>
  );
}
