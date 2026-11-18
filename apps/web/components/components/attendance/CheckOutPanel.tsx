'use client';

import { useId } from 'react';
import { Notice } from '@/components/components';
import type { OnSiteRowView } from '@buxa/shared';
import { checkOutRefusalCopy, type CheckOutRefusal } from '@buxa/shared';
import { canSubmitCheckOut } from '@buxa/shared';
import type { CheckOutDraft } from '@buxa/shared';
import { PickupChoices } from './PickupChoices';
import { Button } from '@/components/elements';

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
  /** When given, a Cancel button sits in the same row as Check out. */
  onCancel?: () => void;
}

/** The check-out form for one on-site person, shown in the check-out dialog. A child needs a guardian; an admin may check a child out with a written reason instead. */
export function CheckOutPanel(props: CheckOutPanelProps) {
  const { id, row, draft, busy, canOverride, refusal, failure, onPatch, onSubmit, onCancel } = props;
  const reasonId = useId();
  const radioName = `pickup-${row.personId}`;
  const submittable = !busy && canSubmitCheckOut(row.isMinor, draft);
  const copy = refusal ? checkOutRefusalCopy(refusal) : null;
  // Unknown (null) still shows any guardians, but only a known child is required to have one.
  const showGuardians = row.isMinor !== false && row.pickupOptions.length > 0;
  // The static line and the refusal's notice would say the same thing, so the line yields to the notice once there is one.
  const noGuardianLine = row.isMinor === true && row.pickupOptions.length === 0 && !copy;

  return (
    <form
      id={id}
      className="checkout-panel"
      onSubmit={event => {
        event.preventDefault();
        if (submittable) {
          onSubmit();
        }
      }}
    >
      {showGuardians && (
        <PickupChoices
          name={radioName}
          options={row.pickupOptions}
          value={draft.collectedBy}
          onChange={collectedBy => onPatch({ collectedBy })}
        />
      )}
      {noGuardianLine && <p className="muted">No guardian who may collect this child is linked yet.</p>}
      {row.isMinor !== false && canOverride && (
        <div className="stack">
          <label className="field" htmlFor={reasonId}>
            <span className="field-label">Admin override: reason (only if no guardian can collect)</span>
            <textarea
              id={reasonId}
              rows={2}
              maxLength={500}
              value={draft.overrideReason ?? ''}
              onChange={event => onPatch({ overrideReason: event.target.value })}
            />
          </label>
        </div>
      )}
      {copy && <Notice tone="crit" title={copy.title} body={copy.body} />}
      {failure && <Notice tone="crit" title="Not checked out" body={failure} />}
      <div className="checkout-actions">
        {onCancel && (
          <Button type="button" className="onsite-btn" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="primary" type="submit" className="onsite-btn" disabled={!submittable}>
          {busy ? 'Checking out…' : 'Check out'}
        </Button>
      </div>
    </form>
  );
}
