'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { idle } from '@buxa/shared';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { unassignAction } from '@/actions/groups';
import { FormPopUp } from '@/components/components';
import { Button } from '@/components/elements';
import { HiddenField } from '@/components/atoms';
import { FormRefusal } from './AssignDialog';

const FORM_ID = 'unassign-form';

/**
 * The Unassign button on a group member. It opens a short confirmation that names the person and the group. Success shows a toast;
 * a refusal shows as small polite text under the form. Only rendered for roles that may assign (the page decides).
 */
export function UnassignButton({
  sessionId,
  personId,
  personName,
  groupName,
}: {
  sessionId: string;
  personId: string;
  personName: string;
  groupName: string;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useUi();
  const close = useCallback(() => setOpen(false), []);
  const done = useCallback(
    (message: string) => {
      toast(message);
      setOpen(false);
    },
    [toast],
  );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        icon="user-minus"
        aria-haspopup="dialog"
        aria-label={`Unassign ${personName} from ${groupName}`}
        onClick={() => setOpen(true)}
      >
        Unassign
      </Button>
      {open && (
        <UnassignPopUp
          sessionId={sessionId}
          personId={personId}
          personName={personName}
          groupName={groupName}
          onCancel={close}
          onDone={done}
        />
      )}
    </>
  );
}

function UnassignPopUp({
  sessionId,
  personId,
  personName,
  groupName,
  onCancel,
  onDone,
}: {
  sessionId: string;
  personId: string;
  personName: string;
  groupName: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(unassignAction, idle);

  useEffect(() => {
    if (state.status === 'success') {
      onDone(`${personName} is unassigned from ${groupName}.`);
    }
  }, [state, onDone, personName, groupName]);

  return (
    <FormPopUp
      title={`Unassign ${personName}`}
      intro={`Remove ${personName} from ${groupName} for this session. They can be placed again later.`}
      formId={FORM_ID}
      submitLabel="Unassign"
      pendingLabel="Unassigning..."
      submitIcon="user-minus"
      pending={pending}
      onCancel={onCancel}
    >
      <form id={FORM_ID} action={formAction} className="stack">
        <HiddenField name="sessionId" value={sessionId} />
        <HiddenField name="personId" value={personId} />
        <FormRefusal state={state} />
      </form>
    </FormPopUp>
  );
}
