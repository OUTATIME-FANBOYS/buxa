'use client';

import { useState } from 'react';
import { Dialog } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { archiveCamp } from '@/actions/camp';
import { Button } from '@/components/elements';

/**
 * Asks once, then archives the camp (it keeps its data and moves to Show archived). A failure shows the server's message in the
 * open dialog. On success it toasts, closes, then calls `onArchived`.
 */
export function ArchiveCampDialog({
  campId,
  campName,
  onArchived,
  onClose,
}: {
  campId: string;
  campName: string;
  onArchived: () => void;
  onClose: () => void;
}) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
    onClose();
  };

  const archive = async () => {
    setBusy(true);
    setError(null);
    const result = await archiveCamp({ orgId: campId });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);

      return;
    }
    onClose();
    toast('Camp archived');
    onArchived();
  };

  return (
    <Dialog
      title="Archive camp?"
      onClose={close}
      footer={
        <>
          <Button variant="glass" type="button" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button variant="glass" icon="archive" disabled={busy} onClick={() => void archive()}>
            {busy ? 'Archiving…' : 'Archive camp'}
          </Button>
        </>
      }
    >
      <p>
        Archiving hides {campName} from your camp list. Its people, tasks, attendance and records are kept. You can
        still open it read-only from the camp switcher, under Show archived.
      </p>
      {error && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
