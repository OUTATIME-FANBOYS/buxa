'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components/export';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { archiveCamp, deleteCamp, type CampActionResult } from '@/actions/camp';
import { Button, TextField } from '@/components/elements/export';
import { ROUTES } from '@/config/routes';

type Step = 'archive' | 'delete-ask' | 'delete-type' | null;

/**
 * The owner's danger zone in Settings: archive the camp (keeps its data), or delete it (removes everything).
 * Delete asks twice: "Are you sure?", then the person types the camp name exactly, with matching capitals.
 * Every button is disabled while a request runs, and a failure shows the server's message in the open dialog.
 */
export function DangerZone({ campId, campName }: { campId: string; campName: string }) {
  const router = useRouter();
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

  const run = async (request: () => Promise<CampActionResult>, done: string) => {
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
    toast(done);
    router.push(ROUTES.camp);
    router.refresh();
  };

  const errorLine = error ? (
    <p className="field-error" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <section className="panel danger-zone" aria-labelledby="danger-zone-title">
      <h2 id="danger-zone-title">Danger zone</h2>
      <p className="muted">
        Archive hides this camp and keeps its data. Delete removes the camp and everything in it, for good.
      </p>
      <div className="row">
        <Button variant="secondary" disabled={busy} onClick={() => setStep('archive')}>
          Archive camp
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => setStep('delete-ask')}>
          Delete camp
        </Button>
      </div>

      {step === 'archive' && (
        <Dialog
          title="Archive camp?"
          onClose={close}
          footer={
            <>
              <Button type="button" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void run(() => archiveCamp({ orgId: campId }), 'Camp archived')}
              >
                {busy ? 'Archiving…' : 'Archive camp'}
              </Button>
            </>
          }
        >
          <p>
            Archiving hides {campName} from your camp list. Its people, tasks, attendance and records are kept. You can
            still open it read-only from the camp switcher, under Archived.
          </p>
          {errorLine}
        </Dialog>
      )}

      {step === 'delete-ask' && (
        <Dialog
          title="Delete camp"
          onClose={close}
          footer={
            <>
              <Button type="button" onClick={close}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setStep('delete-type')}>
                Continue
              </Button>
            </>
          }
        >
          <p>Are you sure you want to delete {campName}?</p>
        </Dialog>
      )}

      {step === 'delete-type' && (
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
                disabled={busy || typed !== campName}
                onClick={() => void run(() => deleteCamp({ orgId: campId, confirmName: typed }), 'Camp deleted')}
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
    </section>
  );
}
