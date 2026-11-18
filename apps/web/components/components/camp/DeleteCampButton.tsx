'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components/export';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { deleteCamp, type CampActionResult } from '@/actions/camp';
import { Button, TextField } from '@/components/elements/export';

type Step = 'ask' | 'type' | null;

/**
 * The Delete camp button and its two-step confirmation: "Are you sure?", then the person types the camp name exactly, with
 * matching capitals. It works for an active camp (the danger zone) and for an archived one (the archived list). Every button
 * is disabled while the request runs, and a failure shows the server's message in the open dialog. On success it toasts,
 * then calls `onDeleted`, so the caller decides where to go next.
 */
export function DeleteCampButton({
  campId,
  campName,
  variant = 'danger',
  size = 'md',
  onDeleted,
}: {
  campId: string;
  campName: string;
  variant?: 'danger' | 'danger-soft';
  size?: 'sm' | 'md';
  onDeleted: () => void;
}) {
  const { toast } = useUi();
  const [step, setStep] = useState<Step>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
    setStep(null);
    setTyped('');
    setError(null);
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
    setStep(null);
    setTyped('');
    toast('Camp deleted');
    onDeleted();
  };

  const errorLine = error ? (
    <p className="field-error" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <>
      <Button variant={variant} size={size} icon="trash" disabled={busy} onClick={() => setStep('ask')}>
        Delete camp
      </Button>

      {step === 'ask' && (
        <Dialog
          title="Delete camp"
          onClose={close}
          footer={
            <>
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setStep('type')}>
                Continue
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete {campName}?</p>
        </Dialog>
      )}

      {step === 'type' && (
        <Dialog
          title={`Delete ${campName}`}
          onClose={close}
          footer={
            <>
              <Button type="button" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon="trash"
                disabled={busy || typed !== campName}
                onClick={() => void run(() => deleteCamp({ orgId: campId, confirmName: typed }))}
              >
                {busy ? 'Deleting…' : 'Delete camp'}
              </Button>
            </>
          }
        >
          <p>
            This removes {campName} and everything in it: people, tasks, attendance and records. It cannot be undone.
          </p>
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
      )}
    </>
  );
}
