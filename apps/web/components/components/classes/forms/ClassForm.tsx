'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/elements';
import { DateTimeField, NumberField, TextField } from '@/components/atoms';
import { sessionPath } from '@/config/routes';
import { fieldError, idle, NO_WEEKDAY } from '@buxa/shared';
import { MAX_CAMP_SIZE, MAX_CLASS_AGE, MIN_CAMP_SIZE, MIN_CLASS_AGE } from '@buxa/domain';
import { addSeriesAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { InstructorPicker } from './InstructorPicker';
import { PriceFields } from './PriceFields';
import { WeekdayField } from './WeekdayField';

export interface InstructorChoice {
  id: string;
  name: string;
}

/**
 * A new class series: its name, ages, camp size, the days ticked (at least one), the Starts and Ends date-times, location and
 * instructors. The server writes the series and one day per ticked weekday in one transaction. Editing is the series' own form
 * (EditSeriesButton). `variant` says where it renders: on its own page (a panel, with its own Cancel and save buttons) or in a dialog.
 * A dialog's buttons belong to the dialog's pinned footer, so the form is tied to them by `formId` and reports `pending` through
 * `onPendingChange`. When the save succeeds, `onSaved` runs with the server's message, so the dialog can close and toast it.
 */
export function ClassForm({
  sessionId,
  sessionName,
  instructors,
  variant = 'page',
  formId,
  onSaved,
  onPendingChange,
}: {
  sessionId: string;
  sessionName: string;
  instructors: readonly InstructorChoice[];
  variant?: 'page' | 'dialog';
  /** The id the dialog footer's submit button names with its `form` attribute. */
  formId?: string;
  onSaved?: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, seriesAction, pending] = useActionState(addSeriesAction, idle);
  const [noWeekday, setNoWeekday] = useState(false);
  const zone = useBrowserZone();
  // Starts and Ends are posted as typed; the server reads their dates and times in the camp's clock.
  const submit = (data: FormData) => {
    // A class needs at least one day. With none ticked, the form says so and sends nothing.
    const none = data.getAll('weekdays').length === 0;
    setNoWeekday(none);
    if (none) {
      return;
    }
    seriesAction(data);
  };
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';
  const [discountProblem, setDiscountProblem] = useState(false);
  // A discount that leaves no price is refused here, with its message on the field, before anything is sent.
  const refuseIfDiscountInvalid = (event: FormEvent<HTMLFormElement>) => {
    if (discountProblem) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Saved.');
    }
  }, [state, onSaved]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);
  const weekdayError = err('weekdays') ?? (noWeekday ? NO_WEEKDAY : undefined);

  return (
    <form
      id={formId}
      ref={formRef}
      action={submit}
      noValidate
      onSubmit={refuseIfDiscountInvalid}
      className={`${inDialog ? '' : 'panel '}class-form class-form-time`}
      aria-describedby="class-form-help"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <p id="class-form-help" className="class-helper">
        {zone ? `Times are in your time zone (${zone}).` : 'Times are in your time zone.'} The class must fall on days
        inside {sessionName}. Fields marked with an asterisk are required.
      </p>
      <TextField
        label="Class name"
        isRequired
        name="name"
        defaultValue=""
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      {/* Three equal columns (33%) on one row; the labels and inputs start on the same line. */}
      <div className="buxa:grid buxa:grid-cols-3 buxa:gap-[var(--s3)] buxa:items-start">
        <NumberField
          label="Youngest age"
          isRequired
          name="minAge"
          minValue={MIN_CLASS_AGE}
          maxValue={MAX_CLASS_AGE}
          error={err('minAge')}
        />
        <NumberField
          label="Oldest age"
          isRequired
          name="maxAge"
          minValue={MIN_CLASS_AGE}
          maxValue={MAX_CLASS_AGE}
          error={err('maxAge')}
        />
        <NumberField
          label="Camp Size"
          isRequired
          name="capacity"
          minValue={MIN_CAMP_SIZE}
          maxValue={MAX_CAMP_SIZE}
          error={err('capacity')}
        />
      </div>
      {/* Starts and Ends: two equal columns (50%), side by side. */}
      <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-end">
        <DateTimeField label="Starts" isRequired name="startsAt" defaultValue={null} error={err('startsAt')} />
        <DateTimeField label="Ends" isRequired name="endsAt" defaultValue={null} error={err('endsAt')} />
      </div>
      <WeekdayField error={weekdayError} />
      <TextField
        label="Location"
        isRequired
        name="location"
        defaultValue=""
        error={err('location')}
        maxLength={200}
        autoComplete="off"
      />
      <InstructorPicker instructors={instructors} />
      <PriceFields error={err} onDiscountProblem={setDiscountProblem} />
      <ActionMessage state={state} />
      {!inDialog && (
        <div className="classes-actions">
          <Button variant="ghost" className="classes-target" href={sessionPath(sessionId)}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="plus"
            className="classes-target"
            disabled={pending || discountProblem}
          >
            {pending ? 'Saving...' : 'Add class'}
          </Button>
        </div>
      )}
    </form>
  );
}

/** The zone the browser types in, read after mount so the server and the first client render agree. */
function useBrowserZone(): string | null {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return zone;
}
