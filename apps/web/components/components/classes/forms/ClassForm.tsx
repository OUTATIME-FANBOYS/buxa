'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/elements';
import { Checkbox, DateTimeField, NumberField, TextField } from '@/components/atoms';
import { sessionPath } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { MAX_CAMP_SIZE, MIN_CAMP_SIZE } from '@buxa/domain';
import { addClassAction, updateClassAction } from '@/actions/classes';
import { ActionMessage } from './ActionMessage';
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
  onCancel,
  onSaved,
}: {
  sessionId: string;
  sessionName: string;
  timeZone: string;
  instructors: readonly InstructorChoice[];
  cls?: Class;
  variant?: 'page' | 'dialog';
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
  const chosen = new Set(cls?.instructorIds ?? []);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`${inDialog ? '' : 'panel '}class-form class-form-time`}
      aria-describedby="class-form-help"
    >
      {editing && <input type="hidden" name="classId" value={cls.id} />}
      <input type="hidden" name="sessionId" value={sessionId} />
      <p id="class-form-help" className="class-helper">
        Times are in the camp&apos;s time zone ({timeZone}). The class must fall on days inside {sessionName}. Fields
        marked with an asterisk are required.
      </p>
      <TextField
        label="Class name *"
        name="name"
        defaultValue={cls?.name ?? ''}
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        autoFocus={!inDialog}
      />
      <div className="form-row buxa:flex buxa:flex-wrap buxa:gap-[var(--s3)] buxa:items-end buxa:[&>.field]:flex-[1_1_120px] buxa:[&>.field]:min-w-0 buxa:[&>.button]:flex-none">
        <TextField
          label="Youngest age *"
          name="minAge"
          inputMode="numeric"
          defaultValue={cls ? String(cls.ageRange.minAge) : ''}
          error={err('minAge')}
          autoComplete="off"
        />
        <TextField
          label="Oldest age *"
          name="maxAge"
          inputMode="numeric"
          defaultValue={cls ? String(cls.ageRange.maxAge) : ''}
          error={err('maxAge')}
          autoComplete="off"
        />
        <NumberField
          label="Camp Size *"
          name="capacity"
          minValue={MIN_CAMP_SIZE}
          maxValue={MAX_CAMP_SIZE}
          defaultValue={cls?.capacity}
          error={err('capacity')}
          hint={`A whole number from ${MIN_CAMP_SIZE} to ${MAX_CAMP_SIZE}.`}
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
      <fieldset className="plain buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
        <legend className="field-label buxa:text-[length:var(--fs-b)] buxa:font-semibold buxa:text-[var(--text-2)]">
          Instructors
        </legend>
        {instructors.length === 0 ? (
          <p className="muted">No one has the instructor role yet. Add them under People, then come back.</p>
        ) : (
          <div className="people-checks">
            {instructors.map(i => (
              <Checkbox
                key={i.id}
                className="people-check"
                name="instructorIds"
                value={i.id}
                defaultSelected={chosen.has(i.id)}
              >
                {i.name}
              </Checkbox>
            ))}
          </div>
        )}
      </fieldset>
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
