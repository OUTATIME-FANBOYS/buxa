'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { selectCampAction, unarchiveCamp, type ArchivedCamp, type CampActionResult } from '@/actions/camp';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';
import { DeleteCampButton } from './DeleteCampButton';
import { readRecent, writeRecent } from './CampSwitcher';

/**
 * The person's archived camps, as a table in the same style as the sessions table: the camp name, the date it was archived,
 * and the owner's actions on the right. The name opens the camp, the same as choosing it in the camp switcher. Unarchive asks
 * once; Delete camp uses the two-step confirmation the danger zone uses. With no archived camps the card does not render.
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

  const open = async (camp: ArchivedCamp) => {
    writeRecent(camp.id, readRecent());
    await selectCampAction(camp.id);
    router.push(ROUTES.camp);
    router.refresh();
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

  if (camps.length === 0) {
    return null;
  }

  return (
    <section className="panel" id="archived-camps">
      <h2>Archived camps</h2>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Archived camps</caption>
          <thead>
            <tr>
              <th scope="col">Camp</th>
              <th scope="col">Archived</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {camps.map(camp => (
              <tr key={camp.id}>
                <td>
                  <button type="button" className="row-title classes-target" onClick={() => void open(camp)}>
                    {camp.name}
                  </button>
                </td>
                <td>{formatDate(camp.archivedAt)}</td>
                <td>
                  {camp.role === 'owner' && (
                    <div className="classes-row-actions">
                      <Button variant="glass" disabled={busy} onClick={() => setUnarchiving(camp)}>
                        Unarchive camp
                      </Button>
                      <DeleteCampButton campId={camp.id} campName={camp.name} onDeleted={() => router.refresh()} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unarchiving && (
        <Dialog
          title="Unarchive camp?"
          onClose={close}
          footer={
            <>
              <Button variant="glass" type="button" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button variant="glass" disabled={busy} onClick={() => void unarchive(unarchiving)}>
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
