'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/elements';
import { DateTimeField, NumberField, TextField } from '@/components/atoms';
import { sessionPath } from '@/config/routes';
import { fieldError, idle, instantToLocalInput, localInputToInstant } from '@buxa/shared';
import { MAX_CAMP_SIZE, MAX_CLASS_AGE, MIN_CAMP_SIZE, MIN_CLASS_AGE } from '@buxa/domain';
import { addClassAction, updateClassAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
import { InstructorPicker } from './InstructorPicker';
import type { Class } from '@buxa/contracts';

export interface InstructorChoice {
  id: string;
  name: string;
}

/** The zone the browser types in, read after mount so the server and the first client render agree. */
function useBrowserZone(): string | null {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return zone;
}

/** The times the form posts: each local time it shows becomes the instant it names. A time the clocks skipped is posted as typed,
 * so the server refuses it with a message rather than saving a different time. */
function postInstants(data: FormData): void {
  for (const name of ['startsAt', 'endsAt']) {
    const local = data.get(name);
    if (typeof local === 'string' && local !== '') {
      data.set(name, localInputToInstant(local) ?? local);
    }
  }
}

/**
 * A class: its name, ages, camp size, its own time range, location and instructors. It adds a class to a session (`cls` is
 * left out) or edits one (`cls` is the class being edited). The fields, validation and action are the same for both.
 * `variant` says where it renders: on its own page (a panel, with its own Cancel and save buttons) or in a dialog. A dialog's
 * buttons belong to the dialog's pinned footer, so the form is tied to them by `formId` and reports `pending` through
 * `onPendingChange`. When a dialog's edit is saved, `onSaved` runs so the dialog can close.
 */
export function ClassForm({
  sessionId,
  sessionName,
  instructors,
  cls,
  variant = 'page',
  detailsOnly = false,
  formId,
  onSaved,
  onPendingChange,
}: {
  sessionId: string;
  sessionName: string;
  instructors: readonly InstructorChoice[];
  cls?: Class;
  variant?: 'page' | 'dialog';
  /** A teacher's edit: only the name is shown. The server keeps every other field as it is saved. */
  detailsOnly?: boolean;
  /** The id the dialog footer's submit button names with its `form` attribute. */
  formId?: string;
  onSaved?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const editing = cls !== undefined;
  const [state, formAction, pending] = useActionState(editing ? updateClassAction : addClassAction, idle);
  const zone = useBrowserZone();
  // The form posts the instants: the local times it shows are converted in the browser before the action runs.
  const submit = (data: FormData) => {
    postInstants(data);
    formAction(data);
  };
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

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      id={formId}
      ref={formRef}
      action={submit}
      noValidate
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
          {zone ? `Times are in your time zone (${zone}).` : 'Times are in your time zone.'} The class must fall on days
          inside {sessionName}. Fields marked with an asterisk are required.
        </p>
      )}
      <TextField
        label="Class name"
        isRequired
        name="name"
        defaultValue={cls?.name ?? ''}
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      {!detailsOnly && (
        <>
          {/* Three equal columns (33%) on one row; the labels and inputs start on the same line. */}
          <div className="buxa:grid buxa:grid-cols-3 buxa:gap-[var(--s3)] buxa:items-start">
            <NumberField
              label="Youngest age"
              isRequired
              name="minAge"
              minValue={MIN_CLASS_AGE}
              maxValue={MAX_CLASS_AGE}
              defaultValue={cls?.ageRange.minAge}
              error={err('minAge')}
            />
            <NumberField
              label="Oldest age"
              isRequired
              name="maxAge"
              minValue={MIN_CLASS_AGE}
              maxValue={MAX_CLASS_AGE}
              defaultValue={cls?.ageRange.maxAge}
              error={err('maxAge')}
            />
            <NumberField
              label="Camp Size"
              isRequired
              name="capacity"
              minValue={MIN_CAMP_SIZE}
              maxValue={MAX_CAMP_SIZE}
              defaultValue={cls?.capacity}
              error={err('capacity')}
            />
          </div>
          {/* Starts and Ends: two equal columns (50%), side by side. */}
          <div className="buxa:grid buxa:grid-cols-2 buxa:gap-[var(--s3)] buxa:items-end">
            <DateTimeField
              label="Starts"
              isRequired
              name="startsAt"
              defaultValue={cls ? instantToLocalInput(cls.startsAt) : null}
              error={err('startsAt')}
            />
            <DateTimeField
              label="Ends"
              isRequired
              name="endsAt"
              defaultValue={cls ? instantToLocalInput(cls.endsAt) : null}
              error={err('endsAt')}
            />
          </div>
          <TextField
            label="Location"
            isRequired
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
      {!inDialog && (
        <div className="classes-actions">
          <Button variant="ghost" className="classes-target" href={sessionPath(sessionId)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon="plus" className="classes-target" disabled={pending}>
            {pending ? 'Saving...' : editing ? 'Save class' : 'Add class'}
          </Button>
        </div>
      )}
    </form>
  );
}
