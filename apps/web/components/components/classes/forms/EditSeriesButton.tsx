'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { NumberField, TextField } from '@/components/atoms';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { MAX_CAMP_SIZE, MAX_CLASS_AGE, MIN_CAMP_SIZE, MIN_CLASS_AGE } from '@buxa/domain';
import { fieldError, idle } from '@buxa/shared';
import type { Series } from '@buxa/contracts';
import { updateSeriesAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { InstructorPicker } from './InstructorPicker';
import { PriceFields } from './PriceFields';
import type { InstructorChoice } from './ClassForm';

/**
 * Opens a series' edit form in a dialog: its name, ages, camp size, location, instructors and price, which change on every day of
 * the series. The days keep their own times, so Starts and Ends are shown read only. A teacher on the series (detailsOnly) sees the
 * name only; the server keeps every other field as saved.
 */
export function EditSeriesButton({
  series,
  sessionName,
  instructors,
  detailsOnly = false,
}: {
  series: Series;
  sessionName: string;
  instructors: readonly InstructorChoice[];
  detailsOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { toast } = useUi();
  const [state, formAction, pending] = useActionState(updateSeriesAction, idle);
  useEffect(() => {
    if (state.status === 'success') {
      toast(state.message ?? 'Class saved.');
      setOpen(false);
    }
  }, [state, toast]);
  const formId = `edit-series-${series.id}`;
  const err = (name: string) => fieldError(state, name);

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="sm"
        iconOnly
        icon="edit"
        aria-label={`Edit ${series.name}`}
        title="Edit class"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <FormPopUp
          title="Edit class"
          formId={formId}
          submitLabel="Save class"
          pendingLabel="Saving..."
          submitIcon="save"
          pending={pending}
          onCancel={close}
        >
          <form id={formId} action={formAction} noValidate className="class-form class-form-time">
            <input type="hidden" name="seriesId" value={series.id} />
            <input type="hidden" name="sessionId" value={series.sessionId} />
            <p className="class-helper">
              {detailsOnly
                ? 'You can change the name of this class. Its days, times, ages, camp size, location and instructors are set by the camp.'
                : `These changes apply to every day of this class in ${sessionName}. To change one day, cancel it and add a new class.`}
            </p>
            <TextField
              label="Class name"
              isRequired
              name="name"
              defaultValue={series.name}
              error={err('name')}
              maxLength={120}
              autoComplete="off"
              autoFocus
            />
            {!detailsOnly && (
              <>
                <div className="buxa:grid buxa:grid-cols-3 buxa:gap-[var(--s3)] buxa:items-start">
                  <NumberField
                    label="Youngest age"
                    isRequired
                    name="minAge"
                    minValue={MIN_CLASS_AGE}
                    maxValue={MAX_CLASS_AGE}
                    defaultValue={series.ageRange.minAge}
                    error={err('minAge')}
                  />
                  <NumberField
                    label="Oldest age"
                    isRequired
                    name="maxAge"
                    minValue={MIN_CLASS_AGE}
                    maxValue={MAX_CLASS_AGE}
                    defaultValue={series.ageRange.maxAge}
                    error={err('maxAge')}
                  />
                  <NumberField
                    label="Camp Size"
                    isRequired
                    name="capacity"
                    minValue={MIN_CAMP_SIZE}
                    maxValue={MAX_CAMP_SIZE}
                    defaultValue={series.capacity}
                    error={err('capacity')}
                  />
                </div>
                <TextField
                  label="Location"
                  isRequired
                  name="location"
                  defaultValue={series.location}
                  error={err('location')}
                  maxLength={200}
                  autoComplete="off"
                />
                <InstructorPicker instructors={instructors} defaultIds={series.instructorIds} />
                <PriceFields price={series.price} error={err} onDiscountProblem={() => undefined} />
              </>
            )}
            <ActionMessage state={state} />
          </form>
        </FormPopUp>
      )}
    </>
  );
}
