'use client';

import { useEffect, useRef } from 'react';
import type { CheckInMethod } from '@buxa/contracts';
import { Empty } from '@/components/ui';
import { Notice } from '../components/Notice';
import { PersonCardView } from '../components/PersonCardView';
import { OverrideForm } from '../components/OverrideForm';
import { checkInRefusalCopy } from '../lib/refusals';
import { formatCampTime } from '../lib/time';
import type { PersonCard } from '../lib/card';
import { displayName } from '../lib/name';
import type { CheckInState } from './checkInState';

interface Props {
  state: CheckInState;
  timeZone: string;
  canOverride: boolean;
  onCheckIn: (card: PersonCard, method: CheckInMethod, overrideReason?: string) => void;
  onClear: () => void;
}

/** The result for the current state: nothing, a neutral unknown, an error, the person with their one action, a refusal, or the confirmation. */
export function ResultPanel({ state, timeZone, canOverride, onCheckIn, onClear }: Props) {
  const primary = useRef<HTMLButtonElement>(null);
  // Picking a name by mouse or keyboard puts focus on the action; a scan keeps focus in the scan field for the next badge.
  const pickedBySearch = state.phase === 'ready' && state.method === 'search';
  useEffect(() => { if (pickedBySearch) primary.current?.focus(); }, [pickedBySearch, state.phase]);

  switch (state.phase) {
    case 'idle': return <Empty icon="inbox" title="Ready for the next person" body="Scan a badge, or find a name on the left." />;
    case 'unknown': return <Notice tone="neutral" title="Code not recognised" body="Try the scan again, or find the name on the left." />;
    case 'error': return <Notice tone="crit" title="Could not look that up" body={state.message} />;
    case 'done': return (
      <Notice tone="ok" title={`${displayName(state.card.person)} checked in`}
        body={`At ${formatCampTime(state.entry.checkedInAt, timeZone)}${state.overridden ? ', with an override on record' : ''}. Next person in a moment.`} />
    );
    case 'ready':
    case 'submitting':
    case 'refused':
    case 'failed': {
      const { card } = state;
      const busy = state.phase === 'submitting';
      // The one action is live only when the person can be checked in as they stand (or after a failure, to retry).
      const canSubmit = state.phase === 'ready' || state.phase === 'failed';
      const refusal = state.phase === 'refused' ? state.refusal : null;
      const copy = refusal ? checkInRefusalCopy(refusal, timeZone) : null;
      const offerOverride = canOverride && (refusal?.reason === 'not_valid' || refusal?.reason === 'override_needs_reason');
      return (
        <div className="stack">
          <PersonCardView card={card} timeZone={timeZone}>
            <button ref={primary} type="button" className="btn btn-primary att-btn-lg" disabled={!canSubmit}
              onClick={() => onCheckIn(card, state.method)}>
              {busy ? 'Checking in…' : 'Check in'}
            </button>
          </PersonCardView>
          {copy && <Notice tone="crit" title={copy.title} body={copy.body} />}
          {state.phase === 'failed' && <Notice tone="crit" title="Not checked in" body={state.message} />}
          {offerOverride && (
            <OverrideForm busy={busy} onSubmit={reason => onCheckIn(card, state.method, reason)} />
          )}
          {(state.phase === 'refused' || state.phase === 'failed') && (
            <button type="button" className="btn btn-ghost att-btn-lg" onClick={onClear}>Clear and scan the next person</button>
          )}
        </div>
      );
    }
  }
}
