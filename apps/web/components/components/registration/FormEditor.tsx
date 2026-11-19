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
  sessions,
  initial,
}: {
  mode: 'create' | 'edit';
  formId?: string;
  sessions: readonly { id: string; name: string }[];
  initial?: FormEditorInitial;
}) {
  const [state, formAction, pending] = useActionState(mode === 'create' ? createFormAction : updateFormAction, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const chosen = new Set(initial?.sessionIds ?? []);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form ref={formRef} action={formAction} className="class-form registration-editor">
      {formId && <input type="hidden" name="formId" value={formId} />}

      <TextField
        label="Form name *"
        name="name"
        defaultValue={initial?.name ?? ''}
        error={err('name')}
        maxLength={120}
        autoComplete="off"
        isRequired
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

      <fieldset className="registration-group">
        <legend className="registration-group__title">Sessions this form covers *</legend>
        {sessions.length === 0 ? (
          <p className="muted">Create a session first. A form covers the sessions its families can choose from.</p>
        ) : (
          sessions.map(session => (
            <Checkbox key={session.id} name="sessionIds" value={session.id} defaultSelected={chosen.has(session.id)}>
              {session.name}
            </Checkbox>
          ))
        )}
        {err('sessionIds') && (
          <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
            {err('sessionIds')}
          </span>
        )}
      </fieldset>

      <section className="registration-group" aria-labelledby="registration-questions">
        <h2 id="registration-questions" className="registration-group__title">
          Your questions
        </h2>
        <p className="muted">The standard questions about the camper and family are always asked.</p>
        <QuestionBuilder initial={initial?.fields} />
        {err('fields') && (
          <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
            {err('fields')}
          </span>
        )}
      </section>

      <ActionMessage state={state} />
      <div className="classes-actions">
        <Button
          type="submit"
          variant={mode === 'create' ? 'primary' : 'secondary'}
          disabled={pending || sessions.length === 0}
          className="classes-target"
        >
          {pending ? 'Saving...' : mode === 'create' ? 'Create form' : 'Save draft'}
        </Button>
        {mode === 'create' && (
          <Button variant="ghost" className="classes-target" href={ROUTES.registration}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
