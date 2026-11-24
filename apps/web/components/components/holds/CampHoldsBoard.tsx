'use client';

import { useState } from 'react';
import type { ClockFormat } from '@buxa/domain';
import { Select } from '@/components/atoms';
import { Empty } from '@/components/components';
import { HoldsTable, type HoldRow } from './HoldsTable';
import { WaitlistTable, type WaitRow } from './WaitlistTable';

/**
 * The camp's holds, with each class's waitlist beside them. One filter narrows both to a session. Read only: nothing here promotes a
 * camper (that is on the class page).
 */
export function CampHoldsBoard({
  holds,
  waitlist,
  timeZone,
  clockFormat,
  showSessionFilter = true,
}: {
  holds: readonly HoldRow[];
  waitlist: readonly WaitRow[];
  timeZone: string;
  clockFormat: ClockFormat;
  /** A session's own Holds tab is already one session, so it turns the filter off. */
  showSessionFilter?: boolean;
}) {
  const [sessionId, setSessionId] = useState('');

  const sessions = new Map<string, string>();
  for (const row of [...holds, ...waitlist]) {
    sessions.set(row.sessionId, row.sessionName);
  }
  const options = [...sessions.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
    .map(([value, label]) => ({ value, label }));

  const shownHolds = holds.filter(hold => sessionId === '' || hold.sessionId === sessionId);
  const shownWaitlist = waitlist.filter(row => sessionId === '' || row.sessionId === sessionId);

  return (
    <div className="stack holds-screen">
      {showSessionFilter && options.length > 0 && (
        <Select
          label="Session"
          hideLabel
          className="inline-select"
          value={sessionId}
          onChange={value => setSessionId(value ?? '')}
          options={[{ value: '', label: 'All sessions' }, ...options]}
        />
      )}
      <div className="holds-board">
        <section className="stack" aria-labelledby="holds-held-heading">
          <h2 id="holds-held-heading" className="people-subheading">
            Places held
          </h2>
          {shownHolds.length === 0 ? (
            <Empty icon="clock" title="No one is holding a place right now." />
          ) : (
            <HoldsTable holds={shownHolds} timeZone={timeZone} clockFormat={clockFormat} />
          )}
        </section>
        <section className="stack" aria-labelledby="holds-waitlist-heading">
          <h2 id="holds-waitlist-heading" className="people-subheading">
            Waitlists
          </h2>
          {shownWaitlist.length === 0 ? (
            <Empty icon="list" title="Nobody is on a waitlist right now." />
          ) : (
            <WaitlistTable rows={shownWaitlist} timeZone={timeZone} clockFormat={clockFormat} />
          )}
        </section>
      </div>
    </div>
  );
}
