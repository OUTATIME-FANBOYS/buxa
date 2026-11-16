'use client';

import { useEffect, useRef } from 'react';
import type { ScanFieldHandle } from '@/features/scanner';
import { checkInAnnouncement } from './announce';
import { LiveRegion } from '../components/LiveRegion';
import { NameSearch } from './NameSearch';
import { ResultPanel } from './ResultPanel';
import { ScanPanel } from './ScanPanel';
import { useCheckIn } from './useCheckIn';

interface Props { timeZone: string; canOverride: boolean }

/** The fast screen: one scan field and a name search on the left, the result on the right. Focus returns to the scan field after each person. */
export function CheckInConsole({ timeZone, canOverride }: Props) {
  const { state, scanCode, pickPerson, checkIn, clear } = useCheckIn();
  const scanRef = useRef<ScanFieldHandle>(null);
  const busy = state.phase === 'submitting';

  // Back to the scan field whenever the screen is clear for the next person.
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'unknown' || state.phase === 'error' || state.phase === 'done') {
      scanRef.current?.focus();
    }
  }, [state.phase]);

  return (
    <div className="checkin">
      <section className="checkin-input" aria-label="Find a person">
        <ScanPanel scanRef={scanRef} disabled={busy} onCode={raw => { void scanCode(raw); }} />
        <NameSearch onPick={pickPerson} />
      </section>
      <section className="checkin-result" aria-label="Result">
        <ResultPanel state={state} timeZone={timeZone} canOverride={canOverride}
          onCheckIn={(card, method, reason) => { void checkIn(card, method, reason); }} onClear={clear} />
      </section>
      <LiveRegion message={checkInAnnouncement(state, timeZone)} />
    </div>
  );
}
