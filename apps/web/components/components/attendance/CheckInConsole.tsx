'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScanFieldHandle } from '@/components/components/scanner';
import { checkInAnnouncement, defaultSessionId, type CheckInSessionOption } from '@buxa/shared';
import { Select } from '@/components/atoms';
import { LiveRegion } from '@/components/elements';
import { NameSearch } from './NameSearch';
import { ResultPanel } from './ResultPanel';
import { ScanPanel } from './ScanPanel';
import { useCheckIn } from '@buxa/middleware/hooks/hooks';
import * as attendance from '@/actions/attendance';
import type { ClockFormat } from '@buxa/domain';

interface Props {
  timeZone: string;
  clockFormat: ClockFormat;
  canOverride: boolean;
  /** The camp's sessions in progress or starting today. Empty for a camp without sessions: check-in is then camp-day only. */
  sessions: CheckInSessionOption[];
}

/**
 * The fast screen: a session choice (when the camp has sessions), one scan field and a name search on the left, the result on the
 * right. Focus returns to the scan field after each person. The session is pre-selected when it is the only one on offer.
 */
export function CheckInConsole({ timeZone, clockFormat, canOverride, sessions }: Props) {
  const { state, scanCode, pickPerson, checkIn, clear } = useCheckIn(attendance);
  const scanRef = useRef<ScanFieldHandle>(null);
  const busy = state.phase === 'submitting';
  const [sessionId, setSessionId] = useState<string | null>(() => defaultSessionId(sessions));

  // Back to the scan field whenever the screen is clear for the next person.
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'unknown' || state.phase === 'error' || state.phase === 'done') {
      scanRef.current?.focus();
    }
  }, [state.phase]);

  return (
    <div className="checkin">
      <section className="checkin-input" aria-label="Scan a badge">
        {sessions.length > 0 && (
          <Select
            label="Session"
            options={sessions.map(s => ({ value: s.id, label: s.name }))}
            value={sessionId}
            placeholder="Choose a session"
            onChange={setSessionId}
          />
        )}
        <ScanPanel
          scanRef={scanRef}
          disabled={busy}
          onCode={raw => {
            void scanCode(raw);
          }}
        />
      </section>
      {/* On a phone the result follows the scan field, above the name search, so it is visible without scrolling. */}
      <section className="checkin-result" aria-label="Result">
        <ResultPanel
          state={state}
          timeZone={timeZone}
          clockFormat={clockFormat}
          canOverride={canOverride}
          onCheckIn={(card, method, reason) => {
            void checkIn(card, method, reason, sessionId ?? undefined);
          }}
          onClear={clear}
        />
      </section>
      <section className="checkin-find" aria-label="Find a person">
        <NameSearch onPick={pickPerson} />
      </section>
      <LiveRegion message={checkInAnnouncement(state, timeZone, clockFormat)} />
    </div>
  );
}
