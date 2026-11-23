'use client';

import { useActionState } from 'react';
import type { ClockFormat } from '@buxa/domain';
import { formatCampDateTime, idle } from '@buxa/shared';
import { Button, Pill } from '@/components/elements';
import { promoteWaitlistAction } from '@/actions/classes';
import { ActionMessage } from './forms';

/*
 * The holds on one class and its waitlist, for staff. A hold is a place a family has taken while it completes its registration: it
 * returns to the class if it runs out (15 minutes). The waitlist is shown in the order the campers joined, and the button moves the
 * first of them into a place that is free but not yet given out. A place freed by a cancellation or an expired hold is given out at
 * once by the server; the button is for the rest.
 */

export interface ClassHoldRow {
  id: string;
  householdName: string;
  expiresAt: string;
}

export interface ClassWaitRow {
  id: string;
  camperName: string;
  enrolledAt: string;
}

export function ClassHoldsAndWaitlist({
  sessionId,
  classId,
  holds,
  waitlist,
  freePlaces,
  timeZone,
  clockFormat,
}: {
  sessionId: string;
  classId: string;
  holds: readonly ClassHoldRow[];
  waitlist: readonly ClassWaitRow[];
  freePlaces: number;
  timeZone: string;
  clockFormat: ClockFormat;
}) {
  const [state, formAction, pending] = useActionState(promoteWaitlistAction, idle);
  const ordered = [...waitlist].sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));

  return (
    <div className="stack classes-holds" aria-labelledby={`holds-${classId}`}>
      <h3 id={`holds-${classId}`} className="people-subheading">
        Holds and waitlist
      </h3>

      <h4 className="muted">Held places</h4>
      {holds.length === 0 ? (
        <p className="muted">No place is held right now.</p>
      ) : (
        <ul className="classes-list">
          {holds.map(hold => (
            <li key={hold.id}>
              {hold.householdName}{' '}
              <Pill tone="warn">Held until {formatCampDateTime(hold.expiresAt, timeZone, clockFormat)}</Pill>
            </li>
          ))}
        </ul>
      )}

      <h4 className="muted">Waitlist, in order</h4>
      {ordered.length === 0 ? (
        <p className="muted">Nobody is on the waitlist.</p>
      ) : (
        <ol className="classes-list">
          {ordered.map(row => (
            <li key={row.id}>
              {row.camperName}{' '}
              <span className="muted">joined {formatCampDateTime(row.enrolledAt, timeZone, clockFormat)}</span>
            </li>
          ))}
        </ol>
      )}

      {ordered.length > 0 && (
        <form action={formAction} className="classes-actions">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending || freePlaces === 0}>
            {pending ? 'Moving...' : 'Move the next camper off the waitlist'}
          </Button>
          {freePlaces === 0 && <span className="muted">No place is free.</span>}
          <ActionMessage state={state} />
        </form>
      )}
    </div>
  );
}
