'use client';

import { useActionState, useCallback, useEffect, useId, useState } from 'react';
import type { RegistrationForm } from '@buxa/contracts';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { publishFormAction } from '@/actions/registration';
import { ActionMessage } from '@/components/components/classes/forms';
import { FormEditor } from './FormEditor';

export interface RegistrationFormDialogProps {
  /** Create a new form, or edit the draft of `form`. */
  mode: 'create' | 'edit';
  /** The form being edited. Required in edit mode. */
  form?: RegistrationForm;
  sessions: readonly { id: string; name: string }[];
  onClose: () => void;
}

/**
 * The one pop-up for a registration form, opened from the list (New form) and from a form's View or page (Edit form). Create has
 * one action, Create form. Edit has Save draft (beside it) and the primary Publish, with Cancel on the right. Publishing is its own
 * form, so it publishes the last saved draft, as the page's Publish button always did. A saved draft or a publish closes the pop-up
 * and toasts the server's message.
 */
export function RegistrationFormDialog({ mode, form, sessions, onClose }: RegistrationFormDialogProps) {
  const { toast } = useUi();
  const ids = useId();
  const editorId = `${ids}-editor`;
  const publishId = `${ids}-publish`;
  const [saving, setSaving] = useState(false);
  const [publishState, publishAction, publishing] = useActionState(publishFormAction, idle);

  // A saved draft or a publish closes the pop-up and toasts the server's message.
  const done = useCallback(
    (message: string) => {
      toast(message);
      onClose();
    },
    [toast, onClose],
  );
  useEffect(() => {
    if (publishState.status === 'success') {
      done(publishState.message ?? 'Published.');
    }
  }, [publishState, done]);

  if (mode === 'create') {
    return (
      <FormPopUp
        title="New registration form"
        formId={editorId}
        submitLabel="Create form"
        pendingLabel="Saving..."
        submitIcon="plus"
        pending={saving}
        submitDisabled={sessions.length === 0}
        onCancel={onClose}
      >
        <FormEditor mode="create" id={editorId} sessions={sessions} onPendingChange={setSaving} onSaved={done} />
      </FormPopUp>
    );
  }

  if (!form) {
    return null;
  }
  const busy = saving || publishing;

  return (
    <FormPopUp
      title="Edit registration form"
      formId={publishId}
      submitLabel={form.publishedVersion === null ? 'Publish form' : 'Publish a new version'}
      pendingLabel="Publishing..."
      submitIcon="check"
      pending={busy}
      onCancel={onClose}
      leadingPlacement="end"
      leading={
        <Button variant="glass" form={editorId} disabled={busy}>
          {saving ? 'Saving...' : 'Save draft'}
        </Button>
      }
    >
      <FormEditor
        mode="edit"
        id={editorId}
        formId={form.id}
        sessions={sessions}
        initial={{
          name: form.name,
          sessionIds: form.sessions.map(s => s.id),
          fields: form.fields,
          attachments: form.attachments,
        }}
        onPendingChange={setSaving}
        onSaved={done}
      />
      <section className="form-section" aria-label="Publish">
        <form id={publishId} action={publishAction} className="registration-publish">
          <input type="hidden" name="formId" value={form.id} />
          <ActionMessage state={publishState} />
        </form>
      </section>
    </FormPopUp>
  );
}
