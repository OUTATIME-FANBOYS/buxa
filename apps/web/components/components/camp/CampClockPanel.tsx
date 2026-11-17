'use client';

import { useActionState, useEffect } from 'react';
import type { ClockFormat } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { updateCampClockAction } from '@/actions/camp';

const OPTIONS: { value: ClockFormat; label: string; example: string }[] = [
  { value: '12h', label: '12-hour', example: '9:05 AM' },
  { value: '24h', label: '24-hour', example: '09:05' },
];

/** Chooses how every time in the camp is written. Only roles that may update the camp can change it; the server checks again. */
export function CampClockPanel({ campId, clockFormat, canChange }: { campId: string; clockFormat: ClockFormat; canChange: boolean }) {
  const [state, formAction, pending] = useActionState(updateCampClockAction, idle);
  const { toast } = useUi();

  useEffect(() => {
    if (state.status === 'success') toast('Clock changed');
  }, [state, toast]);

  const current = OPTIONS.find(o => o.value === clockFormat) ?? OPTIONS[1];
  return (
    <section className="panel" aria-labelledby="camp-clock-title">
      <h2 id="camp-clock-title">Camp clock</h2>
      <p className="muted">Every time in the camp is shown on this clock.</p>
      {canChange ? (
        <form action={formAction} className="stack">
          <input type="hidden" name="campId" value={campId} />
          <fieldset className="stack">
            <legend>Clock</legend>
            {OPTIONS.map(option => (
              <label key={option.value} className="row">
                <input type="radio" name="clockFormat" value={option.value} defaultChecked={option.value === clockFormat} />
                <span>{option.label} <span className="muted">({option.example})</span></span>
              </label>
            ))}
          </fieldset>
          {state.status === 'error' && <p className="field-error" role="alert">{state.message}</p>}
          <div><button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save clock'}</button></div>
        </form>
      ) : (
        <p>{current.label} ({current.example}). Ask an admin to change it.</p>
      )}
    </section>
  );
}
