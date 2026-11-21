'use client';

import { useUi } from '@buxa/middleware/providers/UiProvider';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button, Checkbox, DatePicker, TextField } from '@/components/atoms';
import { Segmented } from '@/components/elements';
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

const FORM_ID = 'weekly-series-form';

type EndKind = 'until' | 'count';

/**
 * Adds a weekly series of classes to a session. Each generated class is a normal class with its own enrolments. The series is a
 * weekly rule in the camp's time zone: the server expands it in that zone and checks overlaps and capacity. The dialog's Cancel and
 * Add series sit in its pinned footer, outside the scrolling body.
 */
export function RecurringSeriesButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  // A saved series closes the pop-up and toasts the server's message.
  const saved = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        icon="calendar"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Add a weekly series
      </Button>
      {open && (
        <FormPopUp
          title="Weekly series"
          formId={FORM_ID}
          submitLabel="Add series"
          pendingLabel="Adding..."
          submitIcon="plus"
          pending={pending}
          onCancel={close}
        >
          <SeriesForm sessionId={sessionId} onSaved={saved} onPendingChange={setPending} />
        </FormPopUp>
      )}
    </>
  );
}

function SeriesForm({
  sessionId,
  onSaved,
  onPendingChange,
}: {
  sessionId: string;
  onSaved: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(addRecurringClassesAction, idle);
  const [endKind, setEndKind] = useState<EndKind>('until');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved(state.message ?? 'Weekly series added.');
    }
  }, [state, onSaved]);

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form id={FORM_ID} ref={formRef} action={formAction} noValidate className="class-form session-form">
      <input type="hidden" name="sessionId" value={sessionId} />
      <TextField label="Class name" name="name" error={err('name')} isRequired />

      <section className="form-section" aria-labelledby="series-days">
        <h3 id="series-days" className="form-section__title">
          Days of the week
          <span className="field-required" aria-hidden="true">
            {' *'}
          </span>
        </h3>
        <div className="weekday-row">
          {WEEKDAYS.map(day => (
            <Checkbox key={day.value} name="weekdays" value={day.value}>
              {day.label}
            </Checkbox>
          ))}
        </div>
        {err('weekdays') && (
          <span className="field-error" role="alert">
            {err('weekdays')}
          </span>
        )}
      </section>

      {/* First day and Last day: two equal columns (50%). Last day is asked only when the series stops on a date. */}
      <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-start">
        <DatePicker label="First day" name="firstDate" error={err('firstDate')} isRequired />
        {endKind === 'until' && <DatePicker label="Last day" name="endDate" error={err('endDate')} isRequired />}
      </div>

      {/* Starts and Ends: three equal columns (33%), so each time field is about a third of the dialog. */}
      <div className="buxa:grid buxa:grid-cols-3 buxa:gap-[var(--s3)] buxa:items-start">
        <TextField label="Starts" name="startTime" placeholder="09:00" error={err('startTime')} isRequired />
        <TextField label="Ends" name="endTime" placeholder="10:30" error={err('endTime')} isRequired />
      </div>

      <div className="stops-row">
        <span className="field-label">Stops</span>
        <Segmented
          className="stops-choice"
          label="Stops"
          value={endKind}
          onChange={kind => setEndKind(kind)}
          options={[
            { value: 'until', label: 'On a date' },
            { value: 'count', label: 'After a number of classes' },
          ]}
        />
        <input type="hidden" name="endKind" value={endKind} />
        {endKind === 'count' && (
          <TextField label="Number of classes" name="endCount" error={err('endCount')} isRequired />
        )}
      </div>

      <div className="buxa:grid buxa:grid-cols-3 buxa:gap-[var(--s3)] buxa:items-start">
        <TextField label="Youngest age" name="minAge" error={err('minAge')} isRequired />
        <TextField label="Oldest age" name="maxAge" error={err('maxAge')} isRequired />
        <TextField label="Camp Size" name="capacity" error={err('capacity')} isRequired />
      </div>
      <TextField label="Location" name="location" error={err('location')} isRequired />
      <ActionMessage state={state} />
    </form>
  );
}
