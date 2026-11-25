'use client';

import { useCallback, useState } from 'react';
import type { RegistrationForm } from '@buxa/contracts';
import { Button } from '@/components/elements';
import { FormViewDialog } from './FormViewDialog';
import { RegistrationFormDialog } from './RegistrationFormDialog';

/**
 * The View button on a row of the forms table. It opens the form read only. Its Edit form button closes the view and opens the edit
 * pop-up, which only `canEdit` (registration:manage) allows. The name is in the label, so each row's button is told apart.
 */
export function ViewFormButton({
  form,
  sessions,
  canEdit,
  canSubmit,
}: {
  form: RegistrationForm;
  sessions: readonly { id: string; name: string }[];
  canEdit: boolean;
  canSubmit: boolean;
}) {
  const [viewing, setViewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const closeView = useCallback(() => setViewing(false), []);
  const closeEdit = useCallback(() => setEditing(false), []);
  const openEdit = useCallback(() => {
    setViewing(false);
    setEditing(true);
  }, []);

  return (
    <>
      <Button
        variant="glass"
        size="sm"
        aria-haspopup="dialog"
        aria-label={`View ${form.name}`}
        onClick={() => setViewing(true)}
      >
        View
      </Button>
      {viewing && (
        <FormViewDialog form={form} canEdit={canEdit} canSubmit={canSubmit} onEdit={openEdit} onClose={closeView} />
      )}
      {editing && <RegistrationFormDialog mode="edit" form={form} sessions={sessions} onClose={closeEdit} />}
    </>
  );
}
