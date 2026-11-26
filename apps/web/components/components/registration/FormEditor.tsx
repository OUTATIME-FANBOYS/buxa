'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { CustomField, FormAttachment } from '@buxa/contracts';
import { ATTACHMENT_ACCEPT, ATTACHMENT_HINT, fieldError, idle } from '@buxa/shared';
import { Button, FileField, TextField } from '@/components/elements';
import { createFormAction, removeFormFileAction, updateFormAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';
import { QuestionBuilder } from './QuestionBuilder';
import { SessionPicker } from './SessionPicker';

/*
 * A registration form's name, sessions and own questions, in a pop-up. The same fields create a form and edit its draft: the
 * create mode posts to createFormAction and the edit mode to updateFormAction (with the form id). Saving a draft does not publish
 * it. The buttons are not here: RegistrationFormDialog puts them in the pop-up's pinned footer, tied to this form by `id`.
 */

export interface FormEditorInitial {
  name: string;
  sessionIds: string[];
  fields: CustomField[];
  attachments: FormAttachment[];
}

export function FormEditor({
  mode,
  formId,
  id,
  sessions,
  initial,
  onPendingChange,
  onSaved,
}: {
  mode: 'create' | 'edit';
  formId?: string;
  /** The form element's id. The pop-up's footer submit button names it with its `form` attribute. */
  id: string;
  sessions: readonly { id: string; name: string }[];
  initial?: FormEditorInitial;
  onPendingChange?: (pending: boolean) => void;
  /** Runs with the server's message when the form is saved (a pop-up closes and toasts it). */
  onSaved?: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(mode === 'create' ? createFormAction : updateFormAction, idle);
  // Removing an attachment is its own action, posted from the row's button (formAction), so it never submits the form's draft.
  const [removeState, removeFile] = useActionState(removeFormFileAction, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message ?? 'Saved.');
    }
  }, [state, onSaved]);

  const err = (name: string) => fieldError(state, name);

  return (
    <form id={id} ref={formRef} action={formAction} noValidate className="class-form registration-editor">
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
      </div>

      <section className="form-section form-section--flat" aria-labelledby="registration-sessions">
        <h3
          id="registration-sessions"
          className="form-section__title field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]"
        >
          Sessions this form covers
          <span className="field-required" aria-hidden="true">
            {' *'}
          </span>
        </h3>
        {sessions.length === 0 ? (
          <p className="muted">Create a session first. A form covers the sessions its families can choose from.</p>
        ) : (
          <SessionPicker sessions={sessions} defaultIds={initial?.sessionIds} labelledBy="registration-sessions" />
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

      <section className="form-section" aria-labelledby="registration-files">
        <h3 id="registration-files" className="form-section__title">
          Files for families
        </h3>
        <p className="muted">Forms families can download with the registration, such as a blank immunization form.</p>
        {initial && initial.attachments.length > 0 && (
          <ul className="form-files">
            {initial.attachments.map(file => (
              <li key={file.id} className="form-file">
                <span className="form-file__name">{file.name}</span>
                {mode === 'edit' && (
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    name="fileId"
                    value={file.id}
                    formAction={removeFile}
                    aria-label={`Remove ${file.name}`}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ActionMessage state={removeState} />
        <FileField
          label="Add files"
          name="attachments"
          multiple
          accept={ATTACHMENT_ACCEPT}
          error={err('attachments')}
        />
        <span className="field-hint">{ATTACHMENT_HINT}</span>
      </section>

      {/* A create posts dialog=1, so the action returns a success instead of redirecting to the new form. */}
      {mode === 'create' && <input type="hidden" name="dialog" value="1" />}
      <ActionMessage state={state} />
    </form>
  );
}
