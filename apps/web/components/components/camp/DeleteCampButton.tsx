'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { deleteCamp, type CampActionResult } from '@/actions/camp';
import { Button, TextField } from '@/components/elements';

type Step = 'ask' | 'type';

/**
 * The Delete camp button for the archived list. It opens DeleteCampDialog, the two-step confirmation the switcher shares.
 */
export function DeleteCampButton({
  campId,
  campName,
  onDeleted,
}: {
  campId: string;
  campName: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="glass-danger" icon="trash" onClick={() => setOpen(true)}>
        Delete camp
      </Button>
      {open && (
        <DeleteCampDialog campId={campId} campName={campName} onDeleted={onDeleted} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/**
 * The two-step delete: "Are you sure?", then the person types the camp name exactly, with matching capitals. It serves an
 * active camp (the switcher) and an archived one (the archived list). Every button is disabled while the request runs, and a
 * failure shows the server's message in the open dialog. On success it closes, toasts, then calls `onDeleted`, so the caller
 * decides where to go next.
 */
export function DeleteCampDialog({
  campId,
  campName,
  onDeleted,
  onClose,
}: {
  campId: string;
  campName: string;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const { toast } = useUi();
  const [step, setStep] = useState<Step>('ask');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
    onClose();
  };

  const run = async (request: () => Promise<CampActionResult>) => {
    setBusy(true);
    setError(null);
    const result = await request();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);

      return;
    }
    onClose();
    toast('Camp deleted');
    onDeleted();
  };

  const errorLine = error ? (
    <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
      {error}
    </p>
  ) : null;

  if (step === 'ask') {
    return (
      <Dialog
        title="Delete camp"
        onClose={close}
        footer={
          <>
            <Button variant="glass" type="button" onClick={close}>
              Cancel
            </Button>
            <Button variant="glass-danger" onClick={() => setStep('type')}>
              Continue
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete {campName}?</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`Delete ${campName}`}
      onClose={close}
      footer={
        <>
          <Button variant="glass" type="button" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="glass-danger"
            icon="trash"
            disabled={busy || typed !== campName}
            onClick={() => void run(() => deleteCamp({ orgId: campId, confirmName: typed }))}
          >
            {busy ? 'Deleting…' : 'Delete camp'}
          </Button>
        </>
      }
    >
      <p>This removes {campName} and everything in it: people, tasks, attendance and records. It cannot be undone.</p>
      <TextField
        label="Type the camp name to confirm"
        name="confirmName"
        value={typed}
        onChange={setTyped}
        maxLength={120}
        autoFocus
      />
      {errorLine}
    </Dialog>
  );
}
