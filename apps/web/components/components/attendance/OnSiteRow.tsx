'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/components';
import { Pill, Button } from '@/components/elements';
import type { OnSiteRowView } from '@buxa/shared';
import { useCheckOut } from '@buxa/middleware/hooks/hooks';
import * as attendance from '@/actions/attendance';
import { CheckOutPanel } from './CheckOutPanel';

/** The list's id that receives focus after a check-out, since the row it came from leaves the list. */
export const ON_SITE_LIST_ID = 'on-site-list';

interface Props {
  row: OnSiteRowView;
  canRecord: boolean;
  canOverride: boolean;
}

/**
 * One person on site: name, a Minor mark, the check-in time and the check-out time. The list only holds people nobody has checked out yet,
 * so the check-out time is a dash until a check-out completes. Staff open the check-out form in a dialog.
 */
export function OnSiteRow({ row, canRecord, canOverride }: Props) {
  const router = useRouter();
  const { state, open, close, patch, submit } = useCheckOut(row.personId, attendance);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelOpen = state.phase !== 'closed' && state.phase !== 'done';
  const panelId = `checkout-${row.personId}`;

  useEffect(() => {
    if (state.phase !== 'done') {
      return;
    }
    router.refresh();
    document.getElementById(ON_SITE_LIST_ID)?.focus();
  }, [state.phase, router]);

  // Cancel, Escape and the close button all come here: close the form, then give focus back to the trigger.
  const cancel = () => {
    close();
    toggle.current?.focus();
  };

  return (
    <li className="onsite-row">
      <div className="onsite-head">
        <div className="onsite-who">
          <span className="onsite-name">{row.name}</span>
          {row.isMinor === true && (
            <Pill tone="warn" dot={false}>
              Minor
            </Pill>
          )}
        </div>
      </div>
      <div className="onsite-times">
        <p>Checked in: {row.arrivedAt}</p>
        <p>Checked out: —</p>
      </div>
      {canRecord && (
        <Button
          variant="primary"
          ref={toggle}
          type="button"
          className="onsite-btn"
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          aria-controls={panelOpen ? panelId : undefined}
          onClick={open}
        >
          Check out
        </Button>
      )}
      {state.phase === 'done' && (
        <p role="status" className="ok-ink">
          Checked out.
        </p>
      )}
      {panelOpen && (
        <Dialog title={`Check out ${row.name}`} onClose={cancel}>
          <CheckOutPanel
            id={panelId}
            row={row}
            canOverride={canOverride}
            draft={'draft' in state ? state.draft : { collectedBy: null, overrideReason: null }}
            busy={state.phase === 'submitting'}
            refusal={state.phase === 'refused' ? state.refusal : null}
            failure={state.phase === 'failed' ? state.message : null}
            onPatch={patch}
            onCancel={cancel}
            onSubmit={() => {
              if ('draft' in state) {
                void submit(state.draft);
              }
            }}
          />
        </Dialog>
      )}
    </li>
  );
}
