'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { unarchiveCamp, type ArchivedCamp, type CampActionResult } from '@/actions/camp';
import { Button } from '@/components/elements';
import { DeleteCampButton } from './DeleteCampButton';

/**
 * The person's archived camps. Anyone in one can see its name and archive date. The owner of an archived camp also sees
 * Unarchive (asks once) and Delete camp (the same two-step confirmation as the danger zone). After either, the lists refresh.
 */
export function ArchivedCampsCard({ camps }: { camps: readonly ArchivedCamp[] }) {
  const router = useRouter();
  const { toast } = useUi();
  const [unarchiving, setUnarchiving] = useState<ArchivedCamp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) {
      return;
    }
    setUnarchiving(null);
    setError(null);
  };

  const unarchive = async (camp: ArchivedCamp) => {
    setBusy(true);
    setError(null);
    const result: CampActionResult = await unarchiveCamp({ orgId: camp.id });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);

      return;
    }
    setUnarchiving(null);
    toast('Camp unarchived');
    router.refresh();
  };

  return (
    <section className="panel" id="archived-camps">
      <h2>Archived camps</h2>
      {camps.length === 0 ? (
        <p className="muted">No archived camps.</p>
      ) : (
        // One row per camp: name and date on the left, the owner's buttons on the right of the same line.
        <ul className="archived-list buxa:grid buxa:gap-[var(--s2)]">
          {camps.map(camp => (
            <li
              key={camp.id}
              className="buxa:flex buxa:flex-wrap buxa:items-center buxa:justify-between buxa:gap-[var(--s2)]"
            >
              <span>
                <span>{camp.name}</span> <span className="muted">Archived {formatDate(camp.archivedAt)}</span>
              </span>
              {camp.role === 'owner' && (
                <div className="buxa:flex buxa:flex-wrap buxa:gap-[var(--s2)]">
                  <Button variant="glass" disabled={busy} onClick={() => setUnarchiving(camp)}>
                    Unarchive camp
                  </Button>
                  <DeleteCampButton campId={camp.id} campName={camp.name} onDeleted={() => router.refresh()} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {unarchiving && (
        <Dialog
          title="Unarchive camp?"
          onClose={close}
          footer={
            <>
              <Button variant="glass" type="button" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                variant="glass"
                icon="archive-restore"
                disabled={busy}
                onClick={() => void unarchive(unarchiving)}
              >
                {busy ? 'Unarchiving…' : 'Unarchive camp'}
              </Button>
            </>
          }
        >
          <p>
            {unarchiving.name} becomes an active camp again and returns to your camp list. Its people, tasks, attendance
            and records are unchanged.
          </p>
          {error && (
            <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </section>
  );
}

/** A fixed format in UTC, so the server and the browser print the same date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}
