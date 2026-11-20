'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { CustomField } from '@buxa/contracts';
import { fieldError, idle } from '@buxa/shared';
import { Button, Checkbox, TextField } from '@/components/elements';
import { ROUTES } from '@/config/routes';
import { createFormAction, updateFormAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';
import { QuestionBuilder } from './QuestionBuilder';

/*
 * A registration form's name, season, sessions and own questions. The same screen creates a form and edits its draft: the create
 * mode posts to createFormAction and the edit mode to updateFormAction (with the form id). Saving a draft does not publish it.
 * In a dialog (`variant="dialog"`) the buttons belong to the dialog's pinned footer, tied by `id`, and `onPendingChange` reports
 * the pending state to it.
 */

export interface FormEditorInitial {
  name: string;
  season: string | null;
  sessionIds: string[];
  fields: CustomField[];
}

export function FormEditor({
  mode,
  formId,
  id,
  variant = 'page',
  sessions,
  initial,
  onPendingChange,
}: {
  mode: 'create' | 'edit';
  formId?: string;
  /** The form element's id, for a dialog footer's submit button to name with its `form` attribute. */
  id?: string;
  variant?: 'page' | 'dialog';
  sessions: readonly { id: string; name: string }[];
  initial?: FormEditorInitial;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(mode === 'create' ? createFormAction : updateFormAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const chosen = new Set(initial?.sessionIds ?? []);
  const inDialog = variant === 'dialog';

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      noValidate
      className={`${inDialog ? '' : 'panel '}class-form registration-editor`}
    >
      {formId && <input type="hidden" name="formId" value={formId} />}

      <div className="form-section">
        <TextField
          label="Form name"
          isRequired
          name="name"
          defaultValue={initial?.name ?? ''}
          error={err('name')}
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          label="Season"
          name="season"
          defaultValue={initial?.season ?? ''}
          error={err('season')}
          maxLength={60}
          hint="For example Summer 2027. Only for your own reference."
          autoComplete="off"
        />
      </div>

      <section className="form-section" aria-labelledby="registration-sessions">
        <h3 id="registration-sessions" className="form-section__title">
          Sessions this form covers
          <span className="field-required" aria-hidden="true">
            {' *'}
          </span>
        </h3>
        {sessions.length === 0 ? (
          <p className="muted">Create a session first. A form covers the sessions its families can choose from.</p>
        ) : (
          <div className="check-group">
            {sessions.map(session => (
              <Checkbox key={session.id} name="sessionIds" value={session.id} defaultSelected={chosen.has(session.id)}>
                {session.name}
              </Checkbox>
            ))}
          </div>
        )}
        {err('sessionIds') && (
          <span className="field-error" role="alert">
            {err('sessionIds')}
          </span>
        )}
      </section>

      <section className="form-section" aria-labelledby="registration-questions">
        <h3 id="registration-questions" className="form-section__title">
          Your questions
        </h3>
        <p className="muted">The standard questions about the camper and family are always asked.</p>
        <QuestionBuilder initial={initial?.fields} />
        {err('fields') && (
          <span className="field-error" role="alert">
            {err('fields')}
          </span>
        )}
      </section>

      <ActionMessage state={state} />
      {!inDialog && (
        <div className="classes-actions">
          <Button
            type="submit"
            variant={mode === 'create' ? 'primary' : 'glass'}
            disabled={pending || sessions.length === 0}
            className="classes-target"
          >
            {pending ? 'Saving...' : mode === 'create' ? 'Create form' : 'Save draft'}
          </Button>
          {mode === 'create' && (
            <Button variant="glass" className="classes-target" href={ROUTES.registration}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
