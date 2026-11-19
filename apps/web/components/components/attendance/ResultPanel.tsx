'use client';

import { useEffect, useRef } from 'react';
import type { CheckInMethod } from '@buxa/contracts';
import { Empty } from '@/components/components';
import { Notice } from '@/components/components';
import { PersonCardView } from './PersonCardView';
import { OverrideForm } from './OverrideForm';
import { checkInRefusalCopy } from '@buxa/shared';
import { formatCampTime } from '@buxa/shared';
import type { PersonCard } from '@buxa/shared';
import { attendanceDisplayName } from '@buxa/shared';
import type { CheckInState } from '@buxa/shared';
import type { ClockFormat } from '@buxa/domain';
import { Button } from '@/components/elements';

interface Props {
  state: CheckInState;
  timeZone: string;
  clockFormat: ClockFormat;
  canOverride: boolean;
  onCheckIn: (card: PersonCard, method: CheckInMethod, overrideReason?: string) => void;
  onClear: () => void;
}

/** The result for the current state: nothing, a neutral unknown, an error, the person with their one action, a refusal, or the confirmation. */
export function ResultPanel({ state, timeZone, clockFormat, canOverride, onCheckIn, onClear }: Props) {
  const primary = useRef<HTMLButtonElement>(null);
  // Picking a name by mouse or keyboard puts focus on the action; a scan keeps focus in the scan field for the next badge.
  const pickedBySearch = state.phase === 'ready' && state.method === 'search';
  useEffect(() => {
    if (pickedBySearch) {
      primary.current?.focus();
    }
  }, [pickedBySearch, state.phase]);

  switch (state.phase) {
    case 'idle':
      return <Empty icon="inbox" title="Ready for the next person" body="Scan a badge, or find a name on the left." />;
    case 'unknown':
      return (
        <Notice tone="neutral" title="Code not recognised" body="Try the scan again, or find the name on the left." />
      );
    case 'error':
      return <Notice tone="crit" title="Could not look that up" body={state.message} />;
    case 'done':
      return (
        <Notice
          tone="ok"
          title={`${attendanceDisplayName(state.card.person)} checked in`}
          body={`At ${formatCampTime(state.entry.checkedInAt, timeZone, clockFormat)}${state.overridden ? ', with an override on record' : ''}. Next person in a moment.`}
        />
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
      const copy = refusal ? checkInRefusalCopy(refusal, timeZone, clockFormat) : null;
      const offerOverride =
        canOverride && (refusal?.reason === 'not_valid' || refusal?.reason === 'override_needs_reason');

      return (
        <div className="stack">
          <PersonCardView card={card} timeZone={timeZone} clockFormat={clockFormat}>
            <Button
              variant="primary"
              ref={primary}
              type="button"
              className="att-btn-lg"
              disabled={!canSubmit}
              onClick={() => onCheckIn(card, state.method)}
            >
              {busy ? 'Checking in…' : 'Check in'}
            </Button>
          </PersonCardView>
          {copy && <Notice tone="crit" title={copy.title} body={copy.body} />}
          {state.phase === 'failed' && <Notice tone="crit" title="Not checked in" body={state.message} />}
          {offerOverride && <OverrideForm busy={busy} onSubmit={reason => onCheckIn(card, state.method, reason)} />}
          {(state.phase === 'refused' || state.phase === 'failed') && (
            <Button variant="ghost" type="button" className="att-btn-lg" onClick={onClear}>
              Clear and scan the next person
            </Button>
          )}
        </div>
      );
    }
  }
}
