import type { Session } from '@buxa/contracts';
import { Pill } from '@/components/elements/export';
import type { Tone } from '@buxa/shared';

/** Whether a session has places, is full, or is full with a waitlist. Always a word, never colour alone. */
export function sessionState(session: Pick<Session, 'capacity' | 'seatsTaken' | 'waitlisted'>): { label: string; tone: Tone; full: boolean } {
  const left = session.capacity - session.seatsTaken;
  if (left <= 0) return { label: session.waitlisted > 0 ? 'Full, with a waitlist' : 'Full', tone: 'warn', full: true };
  return { label: left === 1 ? '1 place left' : `${left} places left`, tone: 'ok', full: false };
}

export function SessionStatus({ session }: { session: Pick<Session, 'capacity' | 'seatsTaken' | 'waitlisted'> }) {
  const state = sessionState(session);
  return <Pill tone={state.tone}>{state.label}</Pill>;
}
