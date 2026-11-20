'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/components/Dialog';
import { Button, Checkbox, DatePicker, RadioGroup, TextField } from '@/components/atoms';
import { fieldError, idle } from '@buxa/shared';
import { addRecurringClassesAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';

const WEEKDAYS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

/**
 * Adds a weekly series of classes to a session. Each generated class is a normal class with its own enrolments. Times are
 * typed in the camp's clock; the server expands the rule in the camp's time zone and checks overlaps and capacity.
 */
export function RecurringSeriesButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button type="button" variant="ghost" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add a weekly series
      </Button>
      {open && (
        <Dialog title="Weekly series" onClose={close} className="class-dialog">
          <SeriesForm sessionId={sessionId} onCancel={close} onSaved={close} />
        </Dialog>
      )}
    </>
  );
}

function SeriesForm({
  sessionId,
  onCancel,
  onSaved,
}: {
  sessionId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(addRecurringClassesAction, idle);
  const [endKind, setEndKind] = useState<'until' | 'count'>('until');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved();
    }
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="class-form session-form">
      <input type="hidden" name="sessionId" value={sessionId} />
      <TextField label="Class name" name="name" error={err('name')} />
      <fieldset className="price-fields">
        <legend className="class-helper">Days of the week</legend>
        <div className="form-row">
          {WEEKDAYS.map(day => (
            <Checkbox key={day.value} name="weekdays" value={day.value}>
              {day.label}
            </Checkbox>
          ))}
        </div>
        {err('weekdays') && <p className="field-error">{err('weekdays')}</p>}
      </fieldset>
      <div className="form-row">
        <DatePicker label="First day" name="firstDate" error={err('firstDate')} isRequired />
        <TextField label="Starts" name="startTime" placeholder="09:00" error={err('startTime')} />
        <TextField label="Ends" name="endTime" placeholder="10:30" error={err('endTime')} />
      </div>
      <RadioGroup
        label="Stops"
        name="endKind"
        value={endKind}
        onChange={value => setEndKind(value === 'count' ? 'count' : 'until')}
        options={[
          { value: 'until', label: 'On a date' },
          { value: 'count', label: 'After a number of classes' },
        ]}
      />
      {endKind === 'until' ? (
        <DatePicker label="Last day" name="endDate" error={err('endDate')} />
      ) : (
        <TextField label="Number of classes" name="endCount" error={err('endCount')} />
      )}
      <div className="form-row">
        <TextField label="Youngest age" name="minAge" error={err('minAge')} />
        <TextField label="Oldest age" name="maxAge" error={err('maxAge')} />
        <TextField label="Camp size" name="capacity" error={err('capacity')} />
      </div>
      <TextField label="Location" name="location" error={err('location')} />
      <ActionMessage state={state} />
      <div className="classes-actions">
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Adding...' : 'Add series'}
        </Button>
      </div>
    </form>
  );
}
