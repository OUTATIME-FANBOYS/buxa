'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { archiveCamp, type CampActionResult } from '@/actions/camp';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';
import { DeleteCampButton } from './DeleteCampButton';

/**
 * The danger zone in Settings: archive the camp (keeps its data, org:archive: admin and owner), or delete it (removes
 * everything, org:delete: owner only). A button shows only when the person's role may use it. Delete asks twice: "Are you
 * sure?", then the person types the camp name exactly, with matching capitals (DeleteCampButton). Every button is disabled
 * while a request runs, and a failure shows the server's message in the open dialog. The buttons carry text only.
 */
export function DangerZone({
  campId,
  campName,
  canArchive,
  canDelete,
}: {
  campId: string;
  campName: string;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useUi();
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
    setArchiving(false);
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
    setArchiving(false);
    toast(done);
    router.push(ROUTES.camp);
    router.refresh();
  };

  const errorLine = error ? (
    <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
      {error}
    </p>
  ) : null;

  return (
    // The destructive colour on the border, last in the settings column (forced: .panel's border is unlayered CSS).
    <section className="panel danger-zone buxa:border-[var(--danger)]!" aria-labelledby="danger-zone-title">
      <h2 id="danger-zone-title">Danger zone</h2>
      <p className="muted">
        {canArchive && 'Archive hides this camp and keeps its data.'}
        {canDelete && ' Delete removes the camp and everything in it, for good.'}
      </p>
      <div className="row">
        {canArchive && (
          <Button variant="glass" disabled={busy} onClick={() => setArchiving(true)}>
            Archive camp
          </Button>
        )}
        {canDelete && (
          <DeleteCampButton
            campId={campId}
            campName={campName}
            onDeleted={() => {
              router.push(ROUTES.camp);
              router.refresh();
            }}
          />
        )}
      </div>

      {canArchive && archiving && (
        <Dialog
          title="Archive camp?"
          onClose={close}
          footer={
            <>
              <Button variant="glass" type="button" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                variant="glass"
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
            still open it read-only from the camp switcher, under Show archived.
          </p>
          {errorLine}
        </Dialog>
      )}
    </section>
  );
}
