'use client';

import { useId } from 'react';
import { Notice } from '../components/Notice';
import type { OnSiteRowView } from '../lib/onSiteView';
import { checkOutRefusalCopy, type CheckOutRefusal } from '../lib/refusals';
import { canSubmitCheckOut } from './checkOutInput';
import type { CheckOutDraft } from './checkOutState';
import { PickupChoices } from './PickupChoices';

export interface CheckOutPanelProps {
  id: string;
  row: OnSiteRowView;
  draft: CheckOutDraft;
  busy: boolean;
  canOverride: boolean;
  refusal: CheckOutRefusal | null;
  failure: string | null;
  onPatch: (patch: Partial<CheckOutDraft>) => void;
  onSubmit: () => void;
}

/** The check-out form under one on-site row. A child needs a guardian; an admin may check a child out with a written reason instead. */
export function CheckOutPanel(props: CheckOutPanelProps) {
  const { id, row, draft, busy, canOverride, refusal, failure, onPatch, onSubmit } = props;
  const reasonId = useId();
  const radioName = `pickup-${row.personId}`;
  const submittable = !busy && canSubmitCheckOut(row.isMinor, draft);
  const copy = refusal ? checkOutRefusalCopy(refusal) : null;

  return (
    <form id={id} className="checkout-panel" onSubmit={event => { event.preventDefault(); if (submittable) onSubmit(); }}>
      {row.isMinor && row.pickupOptions.length > 0 && (
        <PickupChoices name={radioName} options={row.pickupOptions} value={draft.collectedBy}
          onChange={collectedBy => onPatch({ collectedBy })} />
      )}
      {row.isMinor && row.pickupOptions.length === 0 && (
        <p className="muted">No guardian who may collect this child is linked yet.</p>
      )}
      {row.isMinor && canOverride && (
        <div className="stack">
          <label className="field" htmlFor={reasonId}>
            <span className="field-label">Admin override: reason (only if no guardian can collect)</span>
            <textarea id={reasonId} rows={2} maxLength={500} value={draft.overrideReason ?? ''}
              onChange={event => onPatch({ overrideReason: event.target.value })} />
          </label>
        </div>
      )}
      {copy && <Notice tone="crit" title={copy.title} body={copy.body} />}
      {failure && <Notice tone="crit" title="Not checked out" body={failure} />}
      <div className="row-end">
        <button type="submit" className="btn btn-primary att-btn-lg" disabled={!submittable}>
          {busy ? 'Checking out…' : 'Check out'}
        </button>
      </div>
    </form>
  );
}
