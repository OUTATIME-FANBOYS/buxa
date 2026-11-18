'use client';

import { useActionState, useEffect, useState } from 'react';
import type { ClockFormat } from '@buxa/domain';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { updateCampClockAction } from '@/actions/camp';
import { Segmented, Button } from '@/components/elements';
import { HiddenField } from '@/components/atoms';

const OPTIONS: { value: ClockFormat; label: string; example: string }[] = [
  { value: '12h', label: '12-hour', example: '9:05 AM' },
  { value: '24h', label: '24-hour', example: '09:05' },
];

const SEGMENTS = OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${o.example})` }));

/** Chooses how every time in the camp is written. Only roles that may update the camp can change it; the server checks again. */
export function CampClockPanel({
  campId,
  clockFormat,
  canChange,
}: {
  campId: string;
  clockFormat: ClockFormat;
  canChange: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCampClockAction, idle);
  const { toast } = useUi();
  const [format, setFormat] = useState<ClockFormat>(clockFormat);

  useEffect(() => {
    if (state.status === 'success') {
      toast('Clock changed');
    }
  }, [state, toast]);

  const current = OPTIONS.find(o => o.value === clockFormat) ?? OPTIONS[1];

  return (
    <div aria-labelledby="camp-clock-title">
      <h3 id="camp-clock-title">Camp clock</h3>
      <p className="muted">Every time in the camp is shown on this clock.</p>
      {canChange ? (
        <form action={formAction} className="stack">
          <HiddenField name="campId" value={campId} />
          <HiddenField name="clockFormat" value={format} />
          <Segmented<ClockFormat> label="Clock" value={format} onChange={setFormat} options={SEGMENTS} />
          {state.status === 'error' && (
            <p className="field-error" role="alert">
              {state.message}
            </p>
          )}
          <div>
            <Button variant="primary" icon="save" disabled={pending}>
              {pending ? 'Saving…' : 'Save clock'}
            </Button>
          </div>
        </form>
      ) : (
        <p>
          {current.label} ({current.example}). Ask an admin to change it.
        </p>
      )}
    </div>
  );
}
