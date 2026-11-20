'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { DateTimeField, NumberField, TextField } from '@/components/atoms';
import { sessionPath } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { MAX_CAMP_SIZE, MAX_CLASS_AGE, MIN_CAMP_SIZE, MIN_CLASS_AGE } from '@buxa/domain';
import { addClassAction, updateClassAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { InstructorPicker } from './InstructorPicker';
import type { Class } from '@buxa/contracts';

export interface InstructorChoice {
  id: string;
  name: string;
}

/**
 * The time of an instant, typed as the camp's clock reads it (YYYY-MM-DDTHH:MM), so the field starts with the saved value.
 * The server reads the field in the camp's zone, so the round trip keeps the same time.
 */
export function campInputValue(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * A class: its name, ages, camp size, its own time range, location and instructors. It adds a class to a session (`cls` is
 * left out) or edits one (`cls` is the class being edited). The fields, validation and action are the same for both.
 * `variant` says where it renders: on its own page (a panel) or in a dialog (no panel, with Cancel through `onCancel`). When a
 * dialog's edit is saved, `onSaved` runs so the dialog can close.
 */
export function ClassForm({
  sessionId,
  sessionName,
  timeZone,
  instructors,
  cls,
  variant = 'page',
  detailsOnly = false,
  onCancel,
  onSaved,
}: {
  sessionId: string;
  sessionName: string;
  timeZone: string;
  instructors: readonly InstructorChoice[];
  cls?: Class;
  variant?: 'page' | 'dialog';
  /** A teacher's edit: only the name is shown. The server keeps every other field as it is saved. */
  detailsOnly?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const editing = cls !== undefined;
  const [state, formAction, pending] = useActionState(editing ? updateClassAction : addClassAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const inDialog = variant === 'dialog';

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    if (state.status === 'success' && editing) {
      onSaved?.();
    }
  }, [state, editing, onSaved]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`${inDialog ? '' : 'panel '}class-form class-form-time`}
      aria-describedby="class-form-help"
    >
      {editing && <input type="hidden" name="classId" value={cls.id} />}
      <input type="hidden" name="sessionId" value={sessionId} />
      {detailsOnly ? (
        <p id="class-form-help" className="class-helper">
          You can change the name of this class. Its times, ages, camp size, location and instructors are set by the
          camp.
        </p>
      ) : (
        <p id="class-form-help" className="class-helper">
          Times are in the camp&apos;s time zone ({timeZone}). The class must fall on days inside {sessionName}. Fields
          marked with an asterisk are required.
        </p>
      )}
      <TextField
        label="Class name *"
        name="name"
        defaultValue={cls?.name ?? ''}
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      {!detailsOnly && (
        <>
          {/* The three fields share one row and start on the same line (items-start), so their labels and inputs align. */}
          <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-start buxa:[&>.field]:flex-[1_1_120px] buxa:[&>.field]:min-w-0">
            <NumberField
              label="Youngest age *"
              name="minAge"
              minValue={MIN_CLASS_AGE}
              maxValue={MAX_CLASS_AGE}
              defaultValue={cls?.ageRange.minAge}
              error={err('minAge')}
            />
            <NumberField
              label="Oldest age *"
              name="maxAge"
              minValue={MIN_CLASS_AGE}
              maxValue={MAX_CLASS_AGE}
              defaultValue={cls?.ageRange.maxAge}
              error={err('maxAge')}
            />
            <NumberField
              label="Camp Size *"
              name="capacity"
              minValue={MIN_CAMP_SIZE}
              maxValue={MAX_CAMP_SIZE}
              defaultValue={cls?.capacity}
              error={err('capacity')}
            />
          </div>
          <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_200px] buxa:[&>.field]:min-w-0">
            <DateTimeField
              label="Starts *"
              name="startsAt"
              isRequired
              defaultValue={cls ? campInputValue(cls.startsAt, timeZone) : null}
              error={err('startsAt')}
            />
            <DateTimeField
              label="Ends *"
              name="endsAt"
              isRequired
              defaultValue={cls ? campInputValue(cls.endsAt, timeZone) : null}
              error={err('endsAt')}
            />
          </div>
          <TextField
            label="Location *"
            name="location"
            defaultValue={cls?.location ?? ''}
            error={err('location')}
            maxLength={200}
            autoComplete="off"
          />
          <InstructorPicker instructors={instructors} defaultIds={cls?.instructorIds ?? []} />
        </>
      )}
      <ActionMessage state={state} />
      <div className="classes-actions">
        {inDialog ? (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" className="classes-target" href={sessionPath(sessionId)}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          icon={editing ? undefined : 'plus'}
          className={inDialog ? undefined : 'classes-target'}
          disabled={pending}
        >
          {pending ? 'Saving...' : editing ? 'Save class' : 'Add class'}
        </Button>
      </div>
    </form>
  );
}
