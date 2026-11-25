'use client';

import { useCallback, useState } from 'react';
import type { RegistrationForm } from '@buxa/contracts';
import { decideFormDeletion, FORM_HAS_REGISTRATIONS_MESSAGE } from '@buxa/domain';
import { Button } from '@/components/elements';
import { DeleteFormDialog } from './DeleteFormDialog';
import { FormViewDialog } from './FormViewDialog';
import { RegistrationFormDialog } from './RegistrationFormDialog';

type OpenDialog = 'view' | 'edit' | 'delete' | null;

/**
 * The three icon buttons at the right end of a row of the forms table: View (an eye, for anyone who sees the page), Edit and Delete
 * (for registration:manage only). Each opens its pop-up here. Delete is disabled, not hidden, when the form has registrations, with
 * the reason as its tooltip; the server refuses the same case again. Each button is named for its form, so the three are told apart.
 */
export function FormRowActions({
  form,
  sessions,
  canEdit,
  canSubmit,
}: {
  form: RegistrationForm;
  sessions: readonly { id: string; name: string }[];
  /** Whether the viewer may edit and delete forms (registration:manage and the session list read). */
  canEdit: boolean;
  /** Whether the viewer may take registrations, which decides who sees the file downloads. */
  canSubmit: boolean;
}) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const close = useCallback(() => setDialog(null), []);
  const openEdit = useCallback(() => setDialog('edit'), []);
  const deletable = decideFormDeletion({ registrationCount: form.submissionCount }).allow;

  return (
    <>
      <div className="classes-row-actions">
        <Button
          type="button"
          variant="glass"
          size="sm"
          iconOnly
          icon="eye"
          aria-label={`View ${form.name}`}
          title="View form"
          aria-haspopup="dialog"
          onClick={() => setDialog('view')}
        />
        {canEdit && (
          <Button
            type="button"
            variant="glass"
            size="sm"
            iconOnly
            icon="edit"
            aria-label={`Edit ${form.name}`}
            title="Edit form"
            aria-haspopup="dialog"
            onClick={openEdit}
          />
        )}
        {canEdit && (
          <Button
            type="button"
            variant="glass-danger"
            size="sm"
            iconOnly
            icon="trash"
            aria-label={`Delete ${form.name}`}
            title={deletable ? 'Delete form' : FORM_HAS_REGISTRATIONS_MESSAGE}
            disabled={!deletable}
            aria-haspopup="dialog"
            onClick={() => setDialog('delete')}
          />
        )}
      </div>
      {dialog === 'view' && (
        <FormViewDialog form={form} canEdit={canEdit} canSubmit={canSubmit} onEdit={openEdit} onClose={close} />
      )}
      {dialog === 'edit' && <RegistrationFormDialog mode="edit" form={form} sessions={sessions} onClose={close} />}
      {dialog === 'delete' && <DeleteFormDialog form={form} onClose={close} />}
    </>
  );
}
