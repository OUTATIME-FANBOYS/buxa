'use client';

import { useState, useTransition } from 'react';
import { Checkbox } from '@/components/atoms';
import { setMemberOptionAction } from '@/actions/members';

/**
 * The check-in and check-out switch for one teacher. It shows the new state at once and saves; a refused save puts the box back
 * and says why. The server checks members:set_options again, so this only shows what the server would accept.
 */
export function CheckInToggle({ userId, firstName, on }: { userId: string; firstName: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="stack">
      <Checkbox
        isSelected={checked}
        isDisabled={pending}
        onChange={next => {
          setChecked(next);
          setMessage(null);
          startTransition(async () => {
            const state = await setMemberOptionAction({ userId, option: 'teacher.check_in_out', enabled: next });
            if (state.status === 'error') {
              setChecked(!next);
              setMessage(state.message);
            }
          });
        }}
      >
        <span className="sr-only">Check in and out, for {firstName}</span>
      </Checkbox>
      {message && (
        <span role="alert" className="muted">
          {message}
        </span>
      )}
    </div>
  );
}
