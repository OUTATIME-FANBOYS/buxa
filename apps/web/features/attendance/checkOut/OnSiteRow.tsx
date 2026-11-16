'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/ui';
import type { OnSiteRowView } from '../lib/onSiteView';
import { useCheckOut } from './useCheckOut';
import { CheckOutPanel } from './CheckOutPanel';

/** The list's id that receives focus after a check-out, since the row it came from leaves the list. */
export const ON_SITE_LIST_ID = 'on-site-list';

interface Props { row: OnSiteRowView; canRecord: boolean; canOverride: boolean }

/** One person on site: name, minors marked, arrival time, and (for staff) a Check out control that opens the panel. */
export function OnSiteRow({ row, canRecord, canOverride }: Props) {
  const router = useRouter();
  const { state, open, close, patch, submit } = useCheckOut(row.personId);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelOpen = state.phase !== 'closed' && state.phase !== 'done';
  const panelId = `checkout-${row.personId}`;

  useEffect(() => {
    if (state.phase !== 'done') return;
    router.refresh();
    document.getElementById(ON_SITE_LIST_ID)?.focus();
  }, [state.phase, router]);

  const cancel = () => { close(); toggle.current?.focus(); };

  return (
    <li className="onsite-row">
      <div className="onsite-head">
        <div className="onsite-who">
          <span className="onsite-name">{row.name}</span>
          {row.isMinor === true && <Pill tone="neutral" dot={false}>Minor</Pill>}
          <span className="muted small">Arrived {row.arrivedAt}</span>
        </div>
        {canRecord && (
          <button ref={toggle} type="button" className="btn att-btn-lg" aria-expanded={panelOpen} aria-controls={panelId}
            onClick={() => (panelOpen ? cancel() : open())}>
            {panelOpen ? 'Cancel' : 'Check out'}
          </button>
        )}
      </div>
      {state.phase === 'done' && <p role="status" className="ok-ink">Checked out.</p>}
      {panelOpen && (
        <CheckOutPanel id={panelId} row={row} canOverride={canOverride}
          draft={'draft' in state ? state.draft : { collectedBy: null, overrideReason: null }}
          busy={state.phase === 'submitting'}
          refusal={state.phase === 'refused' ? state.refusal : null}
          failure={state.phase === 'failed' ? state.message : null}
          onPatch={patch}
          onSubmit={() => { if ('draft' in state) void submit(state.draft); }} />
      )}
    </li>
  );
}
